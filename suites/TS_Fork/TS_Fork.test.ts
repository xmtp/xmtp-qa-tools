import { loadEnv } from "@helpers/client";
import { appendToEnv, getRandomNames } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

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
  manualUsers: {
    USER_CONVOS:
      "83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208",
    USER_CONVOS_DESKTOP:
      "54f447c03b0fe594d499e685fa390d68b85490856469657babe2c8351dbee33f",
    USER_CONVOS_DESKTOP2:
      "ca727d8cd062271a0dab564d6be9be6254fb103bb0bcbfdec660d39f4bc16671",
    USER_CB_WALLET:
      "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
    USER_XMTPCHAT:
      "cfa7ffebd9d083e06bded87f0ecbcb4a19e86dcbb27c99b56980a118840cc856",
    USER_XMTPCHAT2:
      "d18a35dee833c7dab7ef0d89a4c7e3ad1fa914a528864d92ba856ec70731c36f",
  },
  testWorkers: ["bob", "alice", "elon", "joe"],
  checkWorkers: ["fabri", "eve", "dave", "frank"],
  groupId: process.env.GROUP_ID,
};

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker | undefined;
  let globalGroup: Group | undefined;

  it("should initialize workers and create group", async () => {
    const start = performance.now();

    // Initialize workers
    workers = await getWorkers(getRandomNames(testConfig.workers), TEST_NAME);
    creator = workers.get("fabri") as Worker;
    const allWorkers = workers.getWorkers();
    const allClientIds = [
      ...allWorkers.map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers),
    ];

    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;

    // Perform fork check with selected workers
    await forkCheck(globalGroup, allWorkers, testConfig.checkWorkers);
    let count = 1;
    for (const workerName of testConfig.testWorkers) {
      const currentWorker = allWorkers.find((w) => w.name === workerName);
      if (!currentWorker || currentWorker.name === creator.name) continue;

      await sendMessageToGroup(
        currentWorker,
        globalGroup.id,
        `${currentWorker.name}:test ${count}`,
      );
      await membershipChange(
        globalGroup.id,
        creator,
        currentWorker,
        testConfig.epochs,
      );
      count++;
    }

    await globalGroup.send(creator.name + " : Done");

    const end = performance.now();
    console.log(
      `initialize workers and create group - Duration: ${end - start}ms`,
    );
  });
});
// Sends messages to specific workers to check for responses
const forkCheck = async (
  group: Group,
  allWorkers: Worker[],
  testWorkers: string[],
) => {
  const targetWorkers = allWorkers.filter((w) => testWorkers.includes(w.name));
  for (const worker of targetWorkers) {
    await group.send(`hey ${worker.name}`);
  }
};

const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  try {
    const start = performance.now();

    let group: Group;

    if (!testConfig.groupId) {
      console.log(`Creating group with ${addedMembers.length} members`);
      group = await creator.conversations.newGroup([]);
      for (const member of addedMembers) {
        try {
          await group.addMembers([member]);
        } catch (e) {
          console.error(
            `Error adding member ${member} to group ${group.id}:`,
            e,
          );
        }
      }

      const name = testConfig.groupName;
      await group.updateName(name);

      console.log(`Group ${group.id} name updated to ${name}`);
      appendToEnv("GROUP_ID", group.id, testConfig.testName);
    } else {
      console.log(`Fetching group with ID ${testConfig.groupId}`);
      group = (await creator.conversations.getConversationById(
        testConfig.groupId,
      )) as Group;
    }

    const members = await group.members();
    console.log(`Group ${group.id} has ${members.length} members`);

    await group.send("Starting run: " + testConfig.groupName);

    const end = performance.now();
    console.log(`getOrCreateGroup - Duration: ${end - start}ms`);

    return group;
  } catch (e) {
    console.error(`Error creating group:`, e);
    throw e;
  }
};

/**
 * Sends a message from a worker with name and count
 */
export const sendMessageToGroup = async (
  worker: Worker,
  groupId: string,
  message: string,
): Promise<void> => {
  const start = performance.now();

  try {
    await worker.client.conversations.syncAll();

    const foundGroup =
      await worker.client.conversations.getConversationById(groupId);

    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await foundGroup?.send(message);
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
    await memberWhoAdds.client.conversations.sync();

    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;
    if (!group) {
      console.log(`Group ${groupId} not found`);
      throw new Error(`Group ${groupId} not found`);
    }
    console.log(`Group ${groupId} found`);

    const memberInboxId = memberToAdd.client.inboxId;
    const member = await group.members();
    console.log(`Member ${memberInboxId} found`);
    for (let i = 0; i <= trys; i++) {
      try {
        const memberExists = member.find((m) => m.inboxId === memberInboxId);
        if (memberExists) {
          const epochStart = performance.now();
          await group.sync();
          await group.removeMembers([memberInboxId]);
          await group.sync();
          await group.addMembers([memberInboxId]);

          const epochEnd = performance.now();

          console.log(`Epoch ${i} - Duration: ${epochEnd - epochStart}ms`);
          console.warn(`Epoch ${i} done`);
        } else {
          console.warn(`Member ${memberInboxId} not found`);
        }
      } catch (e) {
        console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
      }
    }
  } catch (e) {
    console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
  } finally {
    const end = performance.now();
    console.log(
      `membershipChange for ${memberWhoAdds.name} and ${memberToAdd.name} - Duration: ${end - start}ms`,
    );
  }
};
