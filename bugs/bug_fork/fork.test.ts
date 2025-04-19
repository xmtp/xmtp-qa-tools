import { loadEnv } from "@helpers/client";
import { sendMessageWithCount } from "@helpers/groups";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);
const shouldFix = process.argv.includes("--fix");

const testConfig = {
  testName: TEST_NAME,
  workerNames: [
    "bob-a-203",
    "alice-a-203",
    "ivy-a-203",
    "dave-a-203",
    "eve-a-203",
    "frank-a-203",
    "grace-a-203",
  ],
  creator: "fabri",
  manualUsers: {
    USER_CONVOS: process.env.USER_CONVOS,
    USER_CB_WALLET: process.env.USER_CB_WALLET,
    USER_XMTPCHAT: process.env.USER_XMTPCHAT,
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP,
  },
  workers: undefined as WorkerManager | undefined,
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
    testConfig.workers = await getWorkers(
      testConfig.workerNames,
      TEST_NAME,
      "none",
    );

    // Create or get group
    const manualUsers = Object.values(testConfig.manualUsers).filter(
      Boolean,
    ) as string[];
    const allClientIds = [
      ...testConfig.workers.getWorkers().map((w) => w.client.inboxId),
      ...manualUsers,
    ];

    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;

    if (shouldFix && globalGroup) {
      console.log("--fix flag detected, running recoverForks...");
      await recoverForks(globalGroup);
    }

    if (!globalGroup?.id || !creator)
      throw new Error("Group or creator not found");
  });

  it("should send messages and manage members", async () => {
    if (!globalGroup?.id || !creator || !testConfig.workers)
      throw new Error("Group or creator not found");

    const workers = testConfig.workers.getWorkers();
    for (const worker of workers) {
      if (!worker.client.inboxId)
        throw new Error(`Worker ${worker.name} not properly initialized`);
    }

    await globalGroup.sync();

    // First batch of membership changes and messages
    await membershipChange(globalGroup.id, creator, workers[0]);
    messageCount = await sendMessageWithCount(
      workers[0],
      globalGroup.id,
      messageCount,
    );
    messageCount = await sendMessageWithCount(
      workers[1],
      globalGroup.id,
      messageCount,
    );
    messageCount = await sendMessageWithCount(
      workers[2],
      globalGroup.id,
      messageCount,
    );

    // Second batch
    await membershipChange(globalGroup.id, creator, workers[1]);
    messageCount = await sendMessageWithCount(
      workers[3],
      globalGroup.id,
      messageCount,
    );

    // Third batch
    await membershipChange(globalGroup.id, creator, workers[2]);
    messageCount = await sendMessageWithCount(
      workers[4],
      globalGroup.id,
      messageCount,
    );

    // Fourth batch
    await membershipChange(globalGroup.id, creator, workers[3]);
    messageCount = await sendMessageWithCount(
      workers[5],
      globalGroup.id,
      messageCount,
    );

    // Final batch
    await membershipChange(globalGroup.id, creator, workers[4]);
    messageCount = await sendMessageWithCount(
      workers[6],
      globalGroup.id,
      messageCount,
    );
    await membershipChange(globalGroup.id, creator, workers[5]);

    await globalGroup.send(creator.name + " : Done");
    console.log(`Total message count: ${messageCount}`);
  });
});

const recoverForks = async (group: Group) => {
  const manualUsers = Object.values(testConfig.manualUsers).filter(
    Boolean,
  ) as string[];
  await group.removeMembers(manualUsers);
  await group.addMembers(manualUsers);
};

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

const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
): Promise<void> => {
  try {
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name}`);
    await memberWhoAdds.client.conversations.syncAll();

    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;
    if (!group) {
      console.log(`Group ${groupId} not found`);
      return;
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
    const epochs = 3;
    for (let i = 0; i < epochs; i++) {
      await group.sync();
      await group.removeMembers([memberInboxId]);
      await group.sync();
      await group.addMembers([memberInboxId]);
      await group.sync();
      console.warn(`Epoch ${i} done`);
    }
  } catch (e) {
    console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
  }
};
