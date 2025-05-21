import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { appendToEnv, getFixedNames } from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

// Test configuration
const TEST_NAME = "ts_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  groupName: `Fork group ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
  epochs: 12,
  workers: 14,
  syncInterval: 10000,
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

// Simplified metrics tracking
interface SyncMetrics {
  totalSyncs: number;
  syncErrors: number;
  messageCount: number;
}
const syncMetrics: Record<string, SyncMetrics> = {};

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let start: number;
  let creator: Worker;
  let globalGroup: Group;
  let allClientIds: string[] = [];
  let allWorkers: Worker[] = [];
  let syncIntervalId: NodeJS.Timeout;

  // Helper to sync a worker
  async function syncWorker(worker: Worker, trackMetrics = true) {
    try {
      await worker.client.conversations.syncAll();
      if (trackMetrics) {
        if (!syncMetrics[worker.name]) {
          syncMetrics[worker.name] = {
            totalSyncs: 0,
            syncErrors: 0,
            messageCount: 0,
          };
          const conversations = await worker.client.conversations.list();
          syncMetrics[worker.name].messageCount = (
            await Promise.all(conversations.map((c) => c.messages()))
          ).flat().length;
        }
        syncMetrics[worker.name].totalSyncs++;
      }
    } catch (e) {
      console.error(`Error syncing ${worker.name}:`, e);
      if (syncMetrics[worker.name]) syncMetrics[worker.name].syncErrors++;
    }
  }

  // Helper to sync all workers
  async function syncAllWorkers() {
    const workersList = workers.getAllButCreator();
    await Promise.all(workersList.map((w) => syncWorker(w)));
  }

  // Setup the test
  it("setup", async () => {
    start = performance.now();
    workers = await getWorkers(
      getFixedNames(testConfig.workers),
      TEST_NAME,
      typeofStream.Message,
      typeOfResponse.Gm,
    );
    creator = workers.get("fabri") as Worker;
    await creator.client.conversations.syncAll();
    allWorkers = workers.getAllButCreator();
    allClientIds = [
      ...allWorkers.map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers),
    ];

    // Start periodic sync
    syncIntervalId = setInterval(
      () => void syncAllWorkers(),
      testConfig.syncInterval,
    );
  });

  // Create or get the test group
  it("create group", async () => {
    await syncWorker(creator, false);

    if (!testConfig.groupId) {
      // Create a new group
      console.log(`Creating group with ${allClientIds.length} members`);
      globalGroup = await creator.client.conversations.newGroup([]);
      await globalGroup.sync();

      // Add members in batches to speed up
      for (const member of allClientIds) {
        try {
          await globalGroup.addMembers([member]);
          await globalGroup.sync();

          // Add super admin privileges to manual users
          if (Object.values(testConfig.manualUsers).includes(member)) {
            const key = Object.keys(testConfig.manualUsers).find(
              (k) =>
                testConfig.manualUsers[
                  k as keyof typeof testConfig.manualUsers
                ] === member,
            );
            if (key) await globalGroup.addSuperAdmin(member);
          }
        } catch (e) {
          console.error(`Error adding member ${member}:`, e);
        }
      }

      // Set group name
      await globalGroup.updateName(testConfig.groupName);
      appendToEnv("GROUP_ID", globalGroup.id, testConfig.testName);
    } else {
      // Get existing group
      console.log(`Using existing group ${testConfig.groupId}`);
      globalGroup = (await creator.client.conversations.getConversationById(
        testConfig.groupId,
      )) as Group;
    }

    // Send initial message
    await globalGroup.send(`Starting run: ${testConfig.groupName}`);
  });

  // Test fork check
  it("fork check with message delivery", async () => {
    await syncAllWorkers();

    // Send messages from check workers
    const checkWorkers = allWorkers.filter((w) =>
      testConfig.checkWorkers.includes(w.name),
    );
    for (const worker of checkWorkers) {
      await globalGroup.sync();
      await globalGroup.send(`hey ${worker.name}`);
    }

    // Verify message delivery
    await verifyMessageStream(
      globalGroup,
      allWorkers,
      1,
      `Hi ${allWorkers.map((w) => w.name).join(", ")}`,
    );
  });

  // Test membership changes
  it("membership changes", async () => {
    for (const workerName of testConfig.testWorkers) {
      const worker = allWorkers.find((w) => w.name === workerName);
      if (!worker || worker.name === creator.name) continue;

      // Send a test message
      const group = (await worker.client.conversations.getConversationById(
        globalGroup.id,
      )) as Group;
      if (group) await group.send(`${worker.name}:test`);

      // Perform membership change cycles
      await testMembershipChanges(
        globalGroup.id,
        creator,
        worker,
        testConfig.epochs,
      );
      await syncAllWorkers();
    }
  });

  // Finish test and verify consistency
  it("finalize and verify consistency", async () => {
    await globalGroup.send(`${creator.name} : Done`);
    await syncAllWorkers();
    // Verify final message delivery
    await verifyMessageStream(globalGroup, allWorkers, 1, "Final check");
    clearInterval(syncIntervalId);

    // Verify consistent state
    const memberCounts: Record<string, number> = {};
    const messageCounts: Record<string, number> = {};

    for (const worker of allWorkers) {
      try {
        const group = (await worker.client.conversations.getConversationById(
          globalGroup.id,
        )) as Group;
        if (!group) continue;

        const members = await group.members();
        const messages = await group.messages();

        memberCounts[worker.name] = members.length;
        messageCounts[worker.name] = messages.length;
      } catch (e) {
        console.error(`Error verifying state for ${worker.name}:`, e);
      }
    }

    console.debug(JSON.stringify({ memberCounts, messageCounts }, null, 2));

    console.log(`Test duration: ${performance.now() - start}ms`);
  });
});

// Test membership changes in cycles
async function testMembershipChanges(
  groupId: string,
  admin: Worker,
  member: Worker,
  cycles: number,
): Promise<void> {
  console.log(`Testing membership changes: ${admin.name} with ${member.name}`);

  const group = (await admin.client.conversations.getConversationById(
    groupId,
  )) as Group;
  if (!group) throw new Error(`Group ${groupId} not found`);

  const memberInboxId = member.client.inboxId;

  for (let i = 0; i <= cycles; i++) {
    try {
      // Get current members to check if target exists
      const members = await group.members();
      const memberExists = members.some(
        (m) => m.inboxId.toLowerCase() === memberInboxId.toLowerCase(),
      );

      if (memberExists) {
        // Remove and add back the member
        await group.removeMembers([memberInboxId]);
        await group.sync();
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Removed and re-added ${member.name}`);
      } else {
        // Just add the member if not present
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Added missing member ${member.name}`);
      }
    } catch (e) {
      console.error(`Error in membership cycle ${i}:`, e);
    }
  }
}
