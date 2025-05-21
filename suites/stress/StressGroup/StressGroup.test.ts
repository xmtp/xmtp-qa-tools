import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { appendToEnv, getFixedNames } from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

// Test configuration
const TEST_NAME = "ts_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  groupName:
    "Fork group " +
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  epochs: 12,
  workers: 14,
  syncInterval: 10000, // 10 seconds between sync operations
  manualUsers: {
    USER_CONVOS:
      "83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208",
    USER_CONVOS_DESKTOP:
      "3a54da678a547ea3012b55734d22eb5682c74da1747a31f907d36afe20e5b8f9",
    USER_CB_WALLET:
      "7ba6992b03fc8a177b9665c1a04d498dccec65ce40d85f7b1f01160a0eb7dc7d",
    USER_XMTPCHAT:
      "e7950aec8714e774f63d74bed69b75b88593c5f6a477e61128afd92b98f11293",
  },
  testWorkers: ["bot", "bob", "alice", "elon", "joe"],
  checkWorkers: ["fabri", "eve", "dave", "frank"],
  groupId: process.env.GROUP_ID,
};

// Track sync metrics
interface SyncMetrics {
  totalSyncs: number;
  syncErrors: number;
  lastSyncTime: number;
  initialMessageCount: number;
  finalMessageCount: number;
  totalGroups: number;
}

const syncMetrics: Record<string, SyncMetrics> = {};

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker | undefined;
  let globalGroup: Group | undefined;
  let allClientIds: string[] = [];
  let allWorkers: Worker[] = [];
  let syncIntervalId: NodeJS.Timeout;

  it("setup", async () => {
    // Initialize workers
    workers = await getWorkers(
      getFixedNames(testConfig.workers),
      TEST_NAME,
      typeofStream.Message,
      typeOfResponse.Gm,
    );
    creator = workers.get("fabri") as Worker;
    const allWorkers = workers.getAllButCreator();
    allClientIds = [
      ...allWorkers.map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers),
    ];
  });

  it("periodic sync", () => {
    // Start periodic sync
    syncIntervalId = setInterval(() => {
      void syncAllWorkers(workers); // Use void to ignore the promise
    }, testConfig.syncInterval);
  });

  it("create group", async () => {
    // Make sure creator is fully synced before creating group
    await creator?.client.conversations.syncAll();
    if (!creator) {
      throw new Error("Creator not found");
    }
    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;
  });
  it("sync", async () => {
    // Force sync after group creation for all workers
    await syncAllWorkers(workers);

    // Perform fork check with selected workers
    await forkCheck(globalGroup!, allWorkers, testConfig.checkWorkers);
  });

  it("verify message delivery", async () => {
    // Verify message delivery
    await verifyMessageStream(
      globalGroup!,
      allWorkers,
      1,
      "Hi " + allWorkers.map((w) => w.name).join(", "),
    );

    // Sync after fork check
    await syncAllWorkers(workers);
  });

  it("fork check", async () => {
    let count = 1;
    for (const workerName of testConfig.testWorkers) {
      const currentWorker = allWorkers.find((w) => w.name === workerName);
      if (!currentWorker || currentWorker.name === creator!.name) continue;

      // Sync before sending message
      await currentWorker.client.conversations.syncAll();

      await sendMessageToGroup(
        currentWorker,
        globalGroup!.id,
        `${currentWorker.name}:test ${count}`,
      );

      // Sync after sending message
      await currentWorker.client.conversations.syncAll();

      await membershipChange(
        globalGroup!.id,
        creator!,
        currentWorker,
        testConfig.epochs,
      );
      count++;

      // Sync after membership change
      await syncAllWorkers(workers);
    }
  });

  it("verify message delivery", async () => {
    // Verify message delivery
    await verifyMessageStream(
      globalGroup!,
      allWorkers,
      1,
      "Hi " + allWorkers.map((w) => w.name).join(", "),
    );
  });

  it("finalize", async () => {
    await globalGroup!.send(creator!.name + " : Done");

    // Final sync for all workers
    await syncAllWorkers(workers);

    // Stop periodic sync
    clearInterval(syncIntervalId);

    // Collect final metrics
    await collectFinalMetrics(allWorkers);

    // Verify that all workers have consistent state
    await verifyConsistentState(allWorkers, globalGroup!.id);

    const end = performance.now();
    console.log(
      `initialize workers and create group - Duration: ${end - start}ms`,
    );

    // Log sync metrics
    console.log("Sync Metrics:", JSON.stringify(syncMetrics, null, 2));
  });
});

async function syncAllWorkers(workers: WorkerManager) {
  const allWorkers = workers.getAllButCreator();
  console.log(`Running periodic sync for all ${allWorkers.length} workers`);

  for (const worker of allWorkers) {
    try {
      const syncStart = performance.now();

      // Use syncAll which is more thorough than just sync
      await worker.client.conversations.syncAll();

      // Update metrics
      if (!syncMetrics[worker.name]) {
        syncMetrics[worker.name] = {
          totalSyncs: 0,
          syncErrors: 0,
          lastSyncTime: 0,
          initialMessageCount: 0,
          finalMessageCount: 0,
          totalGroups: 0,
        };

        // First sync - capture initial message count
        const allConversations = await worker.client.conversations.list();
        let messageCount = 0;

        for (const convo of allConversations) {
          const messages = await convo.messages();
          messageCount += messages.length;
        }

        syncMetrics[worker.name].initialMessageCount = messageCount;
        syncMetrics[worker.name].totalGroups = allConversations.length;
      }

      syncMetrics[worker.name].totalSyncs++;
      syncMetrics[worker.name].lastSyncTime = performance.now() - syncStart;

      console.log(
        `Sync for ${worker.name} completed in ${syncMetrics[worker.name].lastSyncTime}ms`,
      );
    } catch (e) {
      console.error(`Error syncing ${worker.name}:`, e);
      if (syncMetrics[worker.name]) {
        syncMetrics[worker.name].syncErrors++;
      }
    }
  }
}

async function collectFinalMetrics(allWorkers: Worker[]) {
  console.log("Collecting final metrics...");

  for (const worker of allWorkers) {
    try {
      // Force final sync
      await worker.client.conversations.syncAll();

      // Get final message count
      const allConversations = await worker.client.conversations.list();
      let messageCount = 0;

      for (const convo of allConversations) {
        const messages = await convo.messages();
        messageCount += messages.length;
      }

      if (syncMetrics[worker.name]) {
        syncMetrics[worker.name].finalMessageCount = messageCount;
        syncMetrics[worker.name].totalGroups = allConversations.length;
      }

      console.log(
        `Final metrics for ${worker.name}: ${messageCount} messages, ${allConversations.length} groups`,
      );
    } catch (e) {
      console.error(`Error collecting final metrics for ${worker.name}:`, e);
    }
  }
}

async function verifyConsistentState(allWorkers: Worker[], groupId: string) {
  console.log("Verifying consistent state across workers...");

  const groupMembers: Record<string, number> = {};
  const groupMessages: Record<string, number> = {};

  for (const worker of allWorkers) {
    try {
      const group = (await worker.client.conversations.getConversationById(
        groupId,
      )) as Group;

      if (!group) {
        console.error(`Group ${groupId} not found for worker ${worker.name}`);
        continue;
      }

      // Check members
      const members = await group.members();
      groupMembers[worker.name] = members.length;

      // Check messages
      const messages = await group.messages();
      groupMessages[worker.name] = messages.length;

      console.log(
        `Worker ${worker.name} sees ${members.length} members and ${messages.length} messages in group`,
      );
    } catch (e) {
      console.error(`Error verifying state for ${worker.name}:`, e);
    }
  }

  // Check for consistency
  const memberCounts = Object.values(groupMembers);
  const messageCounts = Object.values(groupMessages);

  const membersConsistent = memberCounts.every(
    (count) => count === memberCounts[0],
  );
  const messagesConsistent = messageCounts.every(
    (count) => count === messageCounts[0],
  );

  console.log(
    `Members consistent: ${membersConsistent} (counts: ${memberCounts.join(", ")})`,
  );
  console.log(
    `Messages consistent: ${messagesConsistent} (counts: ${messageCounts.join(", ")})`,
  );

  // Use expect to verify consistency
  expect(membersConsistent).toBe(true);
  expect(messagesConsistent).toBe(true);
}

const forkCheck = async (
  group: Group,
  allWorkers: Worker[],
  testWorkers: string[],
) => {
  const targetWorkers = allWorkers.filter((w) => testWorkers.includes(w.name));
  for (const worker of targetWorkers) {
    // Sync before sending messages
    await worker.client.conversations.syncAll();
    await group.sync();

    await group.send(`hey ${worker.name}`);

    // Sync after sending messages
    await worker.client.conversations.syncAll();
  }
};

const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  try {
    const start = performance.now();

    // Sync before group operations
    await creator.conversations.syncAll();

    let group: Group;
    console.debug(JSON.stringify(testConfig.manualUsers, null, 2));
    if (!testConfig.groupId) {
      console.log(`Creating group with ${addedMembers.length} members`);
      group = await creator.conversations.newGroup([]);

      // Sync after group creation
      await creator.conversations.syncAll();
      await group.sync();

      for (const member of addedMembers) {
        try {
          await group.addMembers([member]);

          // Sync after each member addition
          await group.sync();

          if (Object.values(testConfig.manualUsers).includes(member)) {
            await group.addSuperAdmin(
              testConfig.manualUsers[
                member as keyof typeof testConfig.manualUsers
              ],
            );
            // Sync after admin change
            await group.sync();
          }
        } catch (e) {
          console.error(
            `Error adding member ${member} to group ${group.id}:`,
            e,
          );
        }
      }

      const name = testConfig.groupName;
      await group.updateName(name);

      // Sync after name update
      await group.sync();

      console.log(`Group ${group.id} name updated to ${name}`);
      appendToEnv("GROUP_ID", group.id, testConfig.testName);
    } else {
      console.log(`Fetching group with ID ${testConfig.groupId}`);
      group = (await creator.conversations.getConversationById(
        testConfig.groupId,
      )) as Group;

      // Sync after fetching group
      await group.sync();
    }

    // Sync before getting members
    await group.sync();
    const members = await group.members();
    console.log(`Group ${group.id} has ${members.length} members`);

    await group.send("Starting run: " + testConfig.groupName);

    // Final sync
    await group.sync();
    await creator.conversations.syncAll();

    const end = performance.now();
    console.log(`getOrCreateGroup - Duration: ${end - start}ms`);

    return group;
  } catch (e) {
    console.error(`Error creating group:`, e);
    throw e;
  }
};

export const sendMessageToGroup = async (
  worker: Worker,
  groupId: string,
  message: string,
): Promise<void> => {
  const start = performance.now();

  try {
    // More thorough sync before sending message
    await worker.client.conversations.syncAll();

    const foundGroup =
      await worker.client.conversations.getConversationById(groupId);

    if (!foundGroup) {
      throw new Error(`Group ${groupId} not found for worker ${worker.name}`);
    }

    // Sync the specific group
    await foundGroup.sync();

    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await foundGroup.send(message);

    // Sync after sending message
    await foundGroup.sync();
    await worker.client.conversations.syncAll();
  } catch (e) {
    console.error(`Error sending from ${worker.name}:`, e);
  } finally {
    const end = performance.now();
    console.log(
      `sendMessageToGroup for ${worker.name} - Duration: ${end - start}ms`,
    );
  }
};

const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  trys: number,
): Promise<void> => {
  const start = performance.now();

  try {
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name}`);

    // More thorough sync before membership changes
    await memberWhoAdds.client.conversations.syncAll();
    await memberToAdd.client.conversations.syncAll();

    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;
    if (!group) {
      console.log(`Group ${groupId} not found`);
      throw new Error(`Group ${groupId} not found`);
    }
    console.log(`Group ${groupId} found`);

    // Sync group specifically
    await group.sync();

    const memberInboxId = memberToAdd.client.inboxId;

    // Sync before getting members
    await group.sync();
    console.log(`Member ${memberInboxId} found`);

    for (let i = 0; i <= trys; i++) {
      try {
        // Sync before each epoch
        await group.sync();

        // Refresh member list on each iteration to ensure accuracy
        const currentMembers = await group.members();
        const memberExists = currentMembers.find(
          (m) => m.inboxId.toLowerCase() === memberInboxId.toLowerCase(),
        );

        if (memberExists) {
          const epochStart = performance.now();

          // Thorough sync before each operation
          await group.sync();
          await memberWhoAdds.client.conversations.syncAll();
          await memberToAdd.client.conversations.syncAll();

          await group.removeMembers([memberInboxId]);

          // Sync after removal
          await group.sync();
          await memberWhoAdds.client.conversations.syncAll();
          await memberToAdd.client.conversations.syncAll();

          await group.addMembers([memberInboxId]);

          // Sync after addition
          await group.sync();
          await memberWhoAdds.client.conversations.syncAll();
          await memberToAdd.client.conversations.syncAll();

          const epochEnd = performance.now();

          console.log(`Epoch ${i} - Duration: ${epochEnd - epochStart}ms`);
          console.warn(`Epoch ${i} done`);
        } else {
          console.warn(
            `Member ${memberInboxId} not found in current member list`,
          );

          // Try to add the member if not found
          try {
            await group.addMembers([memberInboxId]);
            console.log(`Re-added member ${memberInboxId}`);

            // Sync after addition
            await group.sync();
          } catch (addError) {
            console.error(`Error re-adding member ${memberInboxId}:`, addError);
          }
        }
      } catch (e) {
        console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
      }
    }

    // Final sync after all operations
    await group.sync();
    await memberWhoAdds.client.conversations.syncAll();
    await memberToAdd.client.conversations.syncAll();
  } catch (e) {
    console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
  } finally {
    const end = performance.now();
    console.log(
      `membershipChange for ${memberWhoAdds.name} and ${memberToAdd.name} - Duration: ${end - start}ms`,
    );
  }
};
