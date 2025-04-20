import { closeEnv, loadEnv } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type Worker } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { afterAll, describe, it } from "vitest";

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
  manualUsers: {
    USER_CONVOS: process.env.USER_CONVOS,
    USER_CB_WALLET: process.env.USER_CB_WALLET,
    USER_XMTPCHAT: process.env.USER_XMTPCHAT,
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP,
  },
  groupId: process.env.GROUP_ID,
};

describe(TEST_NAME, () => {
  let workers: Worker[];
  let creator: Worker | undefined;
  let globalGroup: Group | undefined;

  afterAll(async () => {
    await closeEnv(TEST_NAME);
  });
  it("should initialize workers and create group", async () => {
    const start = performance.now();
    console.time("initialize workers and create group");

    // Initialize workers
    workers = (
      await getWorkers(testConfig.workerNames, TEST_NAME)
    ).getWorkers();

    creator = workers[0];
    const allClientIds = [
      ...workers.map((w) => w.client.inboxId),
      ...(Object.values(testConfig.manualUsers) as string[]),
    ];

    globalGroup = (await getOrCreateGroup(
      creator.client,
      allClientIds,
    )) as Group;

    let trys = 3;
    let epochs = 5;
    for (let i = 1; i <= trys; i++) {
      await sendMessageToGroup(
        workers[i],
        globalGroup.id,
        workers[i].name + ":" + String(i),
      );
      await membershipChange(globalGroup.id, creator, workers[i], epochs);
    }

    await globalGroup.send(creator.name + " : Done");

    const end = performance.now();
    console.log(
      `initialize workers and create group - Duration: ${end - start}ms`,
    );
    console.timeEnd("initialize workers and create group");
  });
});

const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation | undefined> => {
  const start = performance.now();
  console.time("getOrCreateGroup");

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
  console.log(`Group ${group.id} has ${members.length} members`);

  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  await group.updateName("Fork group " + time);
  await group.send("Starting run for " + time);

  const end = performance.now();
  console.log(`getOrCreateGroup - Duration: ${end - start}ms`);
  console.timeEnd("getOrCreateGroup");

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
  const start = performance.now();
  console.time(`sendMessageToGroup-${worker.name}`);

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
    console.timeEnd(`sendMessageToGroup-${worker.name}`);
  }
};

const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  trys: number,
): Promise<void> => {
  const start = performance.now();
  console.time(`membershipChange-${memberWhoAdds.name}-${memberToAdd.name}`);

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
    const memberInboxId = memberToAdd.client.inboxId;
    for (let i = 0; i <= trys; i++) {
      const epochStart = performance.now();

      await group.addMembers([memberInboxId]);
      await group.removeMembers([memberInboxId]);
      await group.addMembers([memberInboxId]);

      const epochEnd = performance.now();
      console.log(`Epoch ${i} - Duration: ${epochEnd - epochStart}ms`);
      console.warn(`Epoch ${i} done`);
    }
  } catch (e) {
    console.error(`Error managing ${memberToAdd.name} in ${groupId}:`, e);
  } finally {
    const end = performance.now();
    console.log(
      `membershipChange for ${memberWhoAdds.name} and ${memberToAdd.name} - Duration: ${end - start}ms`,
    );
    console.timeEnd(
      `membershipChange-${memberWhoAdds.name}-${memberToAdd.name}`,
    );
  }
};
