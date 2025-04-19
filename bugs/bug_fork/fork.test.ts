import { loadEnv } from "@helpers/client";
import { sendMessageWithCount } from "@helpers/groups";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

// Check if --fix flag is present in command line arguments
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
  },
  workers: undefined as WorkerManager | undefined,
  groupId: undefined as string | undefined,
};

describe(TEST_NAME, () => {
  // Test state
  let globalGroup: Group | undefined;
  let messageCount = 1;
  let creator: Worker | undefined;
  let rootWorker: WorkerManager | undefined;

  // Initialize workers and create group
  it("should initialize all workers at once and create group", async () => {
    // Initialize root worker (fabri)
    rootWorker = await getWorkers([testConfig.creator], TEST_NAME, "message");
    creator = rootWorker.getWorkers()[0];

    // Initialize other workers
    testConfig.workers = await getWorkers(
      testConfig.workerNames,
      TEST_NAME,
      "none",
    );

    // Create or get group
    const manualUsers = Object.values(testConfig.manualUsers).filter(
      (user) => user !== undefined,
    );

    globalGroup = (await getOrCreateGroup(creator.client, [
      ...testConfig.workers.getWorkers().map((w) => w.client.inboxId),
      ...manualUsers,
    ])) as Group;

    // Only run recoverForks if --fix flag is present
    if (shouldFix && globalGroup) {
      console.log("--fix flag detected, running recoverForks...");
      await recoverForks(globalGroup);
    }

    // Validate state
    if (!globalGroup?.id || !creator) {
      throw new Error("Group or creator not found");
    }
  });

  // Test message sending and group management
  it("should send messages to group and manage members", async () => {
    // Validate initial state
    if (!globalGroup?.id || !creator || !testConfig.workers) {
      throw new Error("Group or creator not found");
    }
    // Get all workers
    const allWorkers = testConfig.workers?.getWorkers();

    // Verify all workers are initialized correctly
    for (const worker of allWorkers) {
      if (!worker.client.inboxId) {
        throw new Error(`Worker ${worker.name} not properly initialized`);
      }
    }

    await globalGroup.sync();

    // Bob adds alice and dave
    await membershipChange(globalGroup.id, creator, allWorkers[0]);
    // Bob sends message
    messageCount = await sendMessageWithCount(
      allWorkers[0],
      globalGroup.id,
      messageCount,
    );

    // Alice and Dave send messages
    messageCount = await sendMessageWithCount(
      allWorkers[1],
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      allWorkers[2],
      globalGroup.id,
      messageCount,
    );

    // Add manual user to group
    await membershipChange(globalGroup.id, creator, allWorkers[1]);
    // Bob sends message
    messageCount = await sendMessageWithCount(
      allWorkers[3],
      globalGroup.id,
      messageCount,
    );

    // Phase 2: Add eve, frank, and grace
    await membershipChange(globalGroup.id, creator, allWorkers[2]);

    // New members send messages
    messageCount = await sendMessageWithCount(
      allWorkers[4],
      globalGroup.id,
      messageCount,
    );

    // Phase 2: Add eve, frank, and grace
    await membershipChange(globalGroup.id, creator, allWorkers[3]);
    messageCount = await sendMessageWithCount(
      allWorkers[5],
      globalGroup.id,
      messageCount,
    );
    // Phase 2: Add eve, frank, and grace
    await membershipChange(globalGroup.id, creator, allWorkers[4]);

    messageCount = await sendMessageWithCount(
      allWorkers[6],
      globalGroup.id,
      messageCount,
    );

    await membershipChange(globalGroup.id, creator, allWorkers[5]);

    await globalGroup.send(creator.name + " : Done");

    console.log(`Total message count: ${messageCount}`);
  });
});

const recoverForks = async (group: Group) => {
  console.log("Recovering forks");
  const manualUsers = Object.values(testConfig.manualUsers).filter(
    (user) => user !== undefined,
  );
  await group.removeMembers(manualUsers);
  await group.addMembers(manualUsers);
};

/**
 * Gets or creates a group
 */
const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  const GROUP_ID = process.env.GROUP_ID;
  let fetchedGroup: Group | undefined;
  if (!GROUP_ID) {
    console.log(`Creating group with ${addedMembers.length} members`);
    fetchedGroup = await creator.conversations.newGroup(addedMembers);
    appendToEnv("GROUP_ID", fetchedGroup.id, testConfig.testName);
  } else {
    console.log(`Fetching group with ID ${GROUP_ID}`);
    fetchedGroup = (await creator.conversations.getConversationById(
      GROUP_ID,
    )) as Group;
  }

  const fetchedMembers = await fetchedGroup.members();
  if (fetchedMembers.length !== addedMembers.length + 1) {
    console.error(
      `Members dont match`,
      fetchedMembers.length,
      addedMembers.length + 1,
    );
  }

  const date = new Date().toISOString();
  // Extract only hours from the current time (format: HH:MM)
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  console.log(`Current time: ${time}`);
  await fetchedGroup.updateName("Fork group " + time);
  await fetchedGroup.send("Starting run for " + time);

  return fetchedGroup;
};

/**
 * Adds a member to a group
 */
const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
): Promise<void> => {
  try {
    let epochs = 3;
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name} `);
    await memberWhoAdds.client.conversations.syncAll();
    const foundGroup =
      (await memberWhoAdds.client.conversations.getConversationById(
        groupId,
      )) as Group;

    if (!foundGroup) {
      console.log(`Group ${groupId} not found`);
      return;
    }
    await foundGroup.sync();

    // Check if member exists before removing
    const members = await foundGroup.members();
    if (
      !members.some((member) => member.inboxId === memberToAdd.client.inboxId)
    ) {
      console.log(`${memberToAdd.name} is not a member of ${groupId}`);
    } else {
      console.log(`${memberToAdd.name} is a member of ${groupId}`);
    }

    // Check if member is an admin before removing admin role
    const admins = await foundGroup.admins;
    if (admins.includes(memberToAdd.client.inboxId)) {
      console.log(`Removing admin role from ${memberToAdd.name} in ${groupId}`);
      await foundGroup.removeAdmin(memberToAdd.client.inboxId);
    } else {
      console.log(`${memberToAdd.name} is not an admin in ${groupId}`);
    }
    //Check if memberWhoAdds is an admin before removing admin role
    if (admins.includes(memberWhoAdds.client.inboxId)) {
      console.log(
        `memberWhoAdds ${memberWhoAdds.name} is an admin in ${groupId}`,
      );
    } else {
      console.log(
        `memberWhoAdds ${memberWhoAdds.name} is not an admin in ${groupId}`,
      );
    }

    for (let i = 0; i < epochs; i++) {
      await foundGroup.sync();

      await foundGroup.removeMembers([memberToAdd.client.inboxId]);

      await foundGroup.sync();

      await foundGroup.addMembers([memberToAdd.client.inboxId]);

      await foundGroup.sync();
    }
  } catch (e) {
    console.error(
      `Error adding/removing ${memberToAdd.name} to ${groupId}:`,
      e,
    );
  }
};
