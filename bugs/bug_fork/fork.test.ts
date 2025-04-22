import { closeEnv, loadEnv } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type Group,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { afterAll, describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);
const time = new Date().toLocaleTimeString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const testConfig = {
  testName: TEST_NAME,
  workers: parseInt(process.env.WORKERS as string) || 12,
  epochs: parseInt(process.env.EPOCHS as string) || 4,
  manualUsers: {
    USER_XMTPCHAT: process.env.USER_XMTPCHAT || "",
    USER_CONVOS: process.env.USER_CONVOS || "",
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP || "",
    USER_CB_WALLET: process.env.USER_CB_WALLET || "",
  },
  groupId: process.env.GROUP_ID,
};

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker | undefined;
  let globalGroup: Group | undefined;

  afterAll(async () => {
    await closeEnv(TEST_NAME);
  });

  it("should test group forking behavior", async () => {
    const start = performance.now();

    // Initialize workers
    workers = await getWorkers(
      testConfig.workers,
      TEST_NAME,
      "message",
      "gm",
      process.env.XMTP_ENV as XmtpEnv,
      true,
    );
    creator = workers.get("fabri") as Worker;
    const allWorkers = workers.getWorkers();
    console.log("Creator is", creator.name);

    // Get all client IDs including manual users
    const allClientIds = [
      ...allWorkers.map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers).filter((id) => id),
    ];

    // Create or get existing group
    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;

    // Perform fork check with selected workers
    const checkWorkers = ["fabri", "eve", "charlie", "grace"];
    const testWorkers = ["bob", "alice", "elon", "joe"];

    await forkCheck(globalGroup, allWorkers, checkWorkers);

    // Run add/remove membership cycles for each test worker
    for (const workerName of testWorkers) {
      const currentWorker = allWorkers.find((w) => w.name === workerName);
      if (!currentWorker || currentWorker.name === creator.name) continue;

      await sendMessageToGroup(
        currentWorker,
        globalGroup.id,
        `${currentWorker.name}:test`,
      );

      await membershipChange(
        globalGroup.id,
        creator,
        currentWorker,
        testConfig.epochs,
      );
    }

    await globalGroup.send(`${creator.name}: Done`);

    const end = performance.now();
    console.log(`Test completed in ${end - start}ms`);
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

// Creates new group or retrieves existing group
const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  let group: Group;

  if (!testConfig.groupId) {
    console.log(`Creating group with ${addedMembers.length} members`);
    group = await creator.conversations.newGroup(addedMembers);
    appendToEnv("GROUP_ID", group.id, testConfig.testName);
    await group.updateName(`Fork group ${time}`);
  } else {
    console.log(`Fetching group with ID ${testConfig.groupId}`);
    group = (await creator.conversations.getConversationById(
      testConfig.groupId,
    )) as Group;
  }

  if (!group) throw new Error("Group not found");

  const members = await group.members();
  console.log(`Group ${group.id} has ${members.length} members`);
  await group.send(`Starting run for ${time}`);

  return group;
};

// Sends a message from a worker to the group
const sendMessageToGroup = async (
  worker: Worker,
  groupId: string,
  message: string,
): Promise<void> => {
  await worker.client.conversations.syncAll();
  const foundGroup =
    await worker.client.conversations.getConversationById(groupId);
  console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
  await foundGroup?.send(message);
};

// Performs add/remove cycles to trigger group forking
const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  tries: number,
): Promise<void> => {
  try {
    await memberWhoAdds.client.conversations.sync();
    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;

    if (!group) throw new Error(`Group ${groupId} not found`);

    const memberInboxId = memberToAdd.client.inboxId;
    const members = await group.members();
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name}`);

    for (let i = 0; i < tries; i++) {
      try {
        const memberExists = members.find((m) => m.inboxId === memberInboxId);
        if (memberExists) {
          await group.sync();
          await group.removeMembers([memberInboxId]);
          await group.sync();
          await group.addMembers([memberInboxId]);
          await group.updateName(`Fork group ${time}`);
          console.log(`Completed cycle ${i + 1}/${tries}`);
        } else {
          console.warn(`Member ${memberToAdd.name} not found`);
          await group.sync();
        }
      } catch (e) {
        console.error(`Error in cycle ${i + 1} for ${memberToAdd.name}:`, e);
      }
    }
  } catch (e) {
    console.error(`Failed to manage ${memberToAdd.name} in group:`, e);
  }
};
