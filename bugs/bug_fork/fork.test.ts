import { loadEnv } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import {
  getWorkers,
  type Worker,
  type WorkerBase,
  type WorkerManager,
} from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  workerNames: [
    "bob-a-100",
    "alice-a-105",
    "ivy-a-202",
    "dave-a-203",
    "eve-a-105",
  ],
  creator: "fabri",
  manualUsers: {
    USER_CONVOS: process.env.USER_CONVOS,
    USER_CB_WALLET: process.env.USER_CB_WALLET,
    USER_XMTPCHAT: process.env.USER_XMTPCHAT,
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP,
  },
  workers: [] as Worker[],
  groupId: process.env.GROUP_ID,
};

describe(TEST_NAME, () => {
  let globalGroup: Group | undefined;
  let messageCount = 1;
  let creator: Worker | undefined;

  it("should initialize workers and create group", async () => {
    // Initialize workers
    const rootWorker = await getWorkers(
      [testConfig.creator],
      TEST_NAME,
      "message",
    );
    creator = rootWorker.getWorkers()[0];
    const workers = await getWorkers(testConfig.workerNames, TEST_NAME, "none");
    testConfig.workers = workers.getWorkers();

    // Create or get group
    const manualUsers = Object.values(testConfig.manualUsers).filter(
      Boolean,
    ) as string[];
    const allClientIds = [
      ...testConfig.workers.map((w) => w.client.inboxId),
      ...manualUsers,
    ];

    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;

    if (!globalGroup?.id || !creator)
      throw new Error("Group or creator not found");
    await globalGroup.sync();
  });

  it("should send messages and manage members", async () => {
    if (!globalGroup?.id || !creator || !testConfig.workers)
      throw new Error("Group or creator not found");

    let trys = 3;
    let epochs = 5;
    for (let i = 1; i <= trys; i++) {
      await sendMessageToGroup(
        testConfig.workers[i],
        globalGroup.id,
        testConfig.workers[i].name + ":" + String(i),
      );
      await membershipChange(
        globalGroup.id,
        creator,
        testConfig.workers[i],
        epochs,
      );
    }

    await globalGroup.send(creator.name + " : Done");
    console.log(`Total message count: ${messageCount}`);
  });
});

// const recoverForks = async (group: Group) => {
//   const manualUsers = Object.values(testConfig.manualUsers).filter(
//     Boolean,
//   ) as string[];
//   await group.removeMembers(manualUsers);
//   await group.addMembers(manualUsers);
// };

const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  let group: Group;

  if (!testConfig.groupId) {
    console.log(`Creating group with ${addedMembers.length} members`);
    group = await creator.conversations.newGroup(addedMembers);
    appendToEnv("GROUP_ID", group.id, testConfig.testName);
  } else {
    console.log(`Fetching group with ID ${testConfig.groupId}`);
    group = (await creator.conversations.getConversationById(
      testConfig.groupId,
    )) as Group;
  }

  const members = await group.members();
  if (members.length !== addedMembers.length + 1) {
    console.error(
      "Members count mismatch:",
      members.length,
      "vs",
      addedMembers.length + 1,
    );
  }

  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  await group.updateName("Fork group " + time);
  await group.send("Starting run for " + time);

  return group;
};

/**
 * Sends a message from a worker with name and count
 */
export const sendMessageToGroup = async (
  worker: Worker,
  groupId: string,
  message: string,
): Promise<void> => {
  try {
    await worker.client.conversations.syncAll();

    const foundGroup =
      await worker.client.conversations.getConversationById(groupId);

    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await foundGroup?.send(message);
  } catch (e) {
    console.error(`Error sending from ${worker.name}:`, e);
  }
};
const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  trys: number,
): Promise<void> => {
  try {
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name}`);
    await memberWhoAdds.client.conversations.syncAll();

    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;
    if (!group) {
      console.log(`Group ${groupId} not found`);
      throw new Error(`Group ${groupId} not found`);
    }

    await group.sync();

    // Check membership status
    const memberInboxId = memberToAdd.client.inboxId;
    const members = await group.members();
    const isMember = members.some((member) => member.inboxId === memberInboxId);
    console.log(
      `${memberToAdd.name} is ${isMember ? "" : "not "}a member of ${groupId}`,
    );

    // Check admin status
    const admins = await group.admins;
    if (admins.includes(memberInboxId)) {
      console.log(`Removing admin role from ${memberToAdd.name}`);
      await group.removeAdmin(memberInboxId);
    }

    // Perform add/remove cycles
    for (let i = 0; i <= trys; i++) {
      await group.removeMembers([memberInboxId]);
      await group.addMembers([memberInboxId]);
      console.warn(`Epoch ${i} done`);
    }
  } catch (e) {
    console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
  }
};
