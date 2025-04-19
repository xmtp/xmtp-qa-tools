import { type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { appendToEnv, sleep } from "./tests";

/**
 * Creates a group with specified participants and measures performance
 */
export async function createGroupWithBatch(
  creator: Worker,
  allWorkers: WorkerManager,
  batchSize: number,
  installationsPerUser: number,
): Promise<{
  groupId: string | undefined;
  memberCount: number;
  totalInstallations: number;
  executionTimeMs: number;
}> {
  const startTime = performance.now();
  const logLabel = `create group with ${batchSize} participants (${batchSize * installationsPerUser} installations)`;
  console.time(logLabel);

  const group = await creator.client?.conversations.newGroup(
    allWorkers
      .getWorkers()
      .map((w) => w.client.inboxId)
      .slice(0, batchSize),
  );

  const members = await group?.members();
  const totalInstallations = (members ?? []).reduce(
    (sum, m) => sum + (m?.installationIds.length ?? 0),
    0,
  );

  console.log(
    `Group created: ${group?.id} | Members: ${members?.length} | Installations: ${totalInstallations}`,
  );
  console.timeEnd(logLabel);

  return {
    groupId: group?.id,
    memberCount: members?.length ?? 0,
    totalInstallations,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Creates multiple groups with increasing batch sizes
 */
export async function createGroupsWithIncrementalBatches(
  creator: Worker,
  allWorkers: WorkerManager,
  startBatchSize: number = 5,
  batchIncrement: number = 5,
  maxParticipants: number,
  installationsPerUser: number,
) {
  const results = [];

  for (
    let size = startBatchSize;
    size <= maxParticipants;
    size += batchIncrement
  ) {
    const result = await createGroupWithBatch(
      creator,
      allWorkers,
      size,
      installationsPerUser,
    );
    results.push({ batchSize: size, ...result });
  }

  return results;
}

/**
 * Adds a member to a group
 */
export const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
): Promise<void> => {
  try {
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

    await foundGroup.sync();

    await foundGroup.removeMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();

    await foundGroup.addMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();
    await sleep();
  } catch (e) {
    console.error(
      `Error adding/removing ${memberToAdd.name} to ${groupId}:`,
      e,
    );
  }
};

/**
 * Gets or creates a group
 */
export const getOrCreateGroup = async (
  testConfig: { testName: string },
  creator: Client,
  members: string[],
): Promise<Conversation | undefined> => {
  const GROUP_ID = process.env.GROUP_ID;

  if (!GROUP_ID) {
    const group = await creator.conversations.newGroup(members);
    console.log(`Created group: ${group.id} with ${members.length} members`);
    appendToEnv("GROUP_ID", group.id, testConfig.testName);
    return group;
  }

  return await creator.conversations.getConversationById(GROUP_ID);
};

/**
 * Sends a message from a worker with name and count
 */
export const sendMessageWithCount = async (
  worker: Worker,
  groupId: string,
  messageCount: number,
): Promise<number> => {
  try {
    // Random sync choice
    const syncChoice = Math.random() < 0.5;
    await worker.client.conversations[syncChoice ? "sync" : "syncAll"]();
    console.log(`${worker.name} performed ${syncChoice ? "sync" : "syncAll"}`);

    const group =
      await worker.client.conversations.getConversationById(groupId);
    const message = `${worker.name} ${messageCount}`;

    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await group?.send(message);
    return messageCount + 1;
  } catch (e) {
    console.error(`Error sending from ${worker.name}:`, e);
    return messageCount;
  }
};

/**
 * Checks if groups across workers are in a forked state
 */
export const checkForGroupFork = async (
  workers: Worker[],
  groupId: string,
): Promise<boolean> => {
  console.log(`Checking for group fork in ${groupId}`);
  if (workers.length < 2) return false;

  const groupStates: Record<string, any> = {};

  // Get group state from each worker
  for (const worker of workers) {
    try {
      const group = (await worker.client.conversations.getConversationById(
        groupId,
      )) as Group;
      if (!group) continue;

      const members = await group.members();
      groupStates[worker.name] = {
        memberCount: members.length,
        name: group.name,
        description: group.description,
      };

      console.log(
        `${worker.name} state:`,
        JSON.stringify(groupStates[worker.name]),
      );
    } catch (error) {
      console.error(`Error getting state for ${worker.name}:`, error);
    }
  }

  // Compare group states
  const workerNames = Object.keys(groupStates);
  if (workerNames.length < 2) return false;

  const firstState = groupStates[workerNames[0]];
  let forkDetected = false;

  for (let i = 1; i < workerNames.length; i++) {
    const currentState = groupStates[workerNames[i]];
    const currentName = workerNames[i];

    // Check members count
    if (currentState.memberCount !== firstState.memberCount) {
      console.log(
        `FORK: ${workerNames[0]} has ${firstState.memberCount} members, but ${currentName} has ${currentState.memberCount}`,
      );
      forkDetected = true;
    }

    // Check name and description
    if (currentState.name !== firstState.name) {
      console.log(
        `FORK: Group name differs between ${workerNames[0]} and ${currentName}`,
      );
      forkDetected = true;
    }

    if (currentState.description !== firstState.description) {
      console.log(
        `FORK: Group description differs between ${workerNames[0]} and ${currentName}`,
      );
      forkDetected = true;
    }
  }

  if (!forkDetected) {
    console.log("No group fork detected - consistent state across clients");
  }

  return forkDetected;
};

/**
 * Gets workers that are members of a group
 */
export async function getWorkersFromGroup(
  group: Conversation,
  workers: WorkerManager,
): Promise<Worker[]> {
  await group.sync();
  const memberIds = (await group.members()).map((m) => m.inboxId);
  return workers
    .getWorkers()
    .filter((w) => memberIds.includes(w.client.inboxId));
}
