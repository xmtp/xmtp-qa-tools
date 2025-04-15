import { type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { appendToEnv } from "./tests";

/**
 * Creates a group with a specified number of participants and measures performance
 *
 * @param creator - The worker that will create the group
 * @param allWorkers - Record of all available workers
 * @param batchSize - Number of participants to include in the group
 * @param installationsPerUser - Number of installations per user (for logging purposes)
 * @returns Object containing group information and performance metrics
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
  const logLabel = `create group with ${batchSize} participants and total ${
    batchSize * installationsPerUser
  } installations`;

  console.time(logLabel);

  // Create the group with the specified number of participants
  const group = await creator.client?.conversations.newGroup(
    allWorkers
      .getWorkers()
      .map((worker: Worker) => worker.client.inboxId)
      .slice(0, batchSize),
  );

  // Get group members and count installations
  const members = await group?.members();
  let totalInstallations = 0;

  for (const member of members ?? []) {
    totalInstallations += member?.installationIds.length ?? 0;
  }

  console.log(`Group created with id ${group?.id}`);
  console.log(`Total members: ${members?.length}`);
  console.log(`Total installations: ${totalInstallations}`);

  console.timeEnd(logLabel);

  const endTime = performance.now();

  return {
    groupId: group?.id,
    memberCount: members?.length ?? 0,
    totalInstallations,
    executionTimeMs: endTime - startTime,
  };
}

/**
 * Creates multiple groups with increasing batch sizes
 *
 * @param creator - The worker that will create the groups
 * @param allWorkers - Record of all available workers
 * @param startBatchSize - Initial batch size
 * @param batchIncrement - How much to increase batch size for each iteration
 * @param maxParticipants - Maximum number of participants to include
 * @param installationsPerUser - Number of installations per user
 * @returns Array of results from each group creation
 */
export async function createGroupsWithIncrementalBatches(
  creator: Worker,
  allWorkers: WorkerManager,
  startBatchSize: number = 5,
  batchIncrement: number = 5,
  maxParticipants: number,
  installationsPerUser: number,
): Promise<
  Array<{
    batchSize: number;
    groupId: string | undefined;
    memberCount: number;
    totalInstallations: number;
    executionTimeMs: number;
  }>
> {
  const results = [];
  let currentBatchSize = startBatchSize;

  while (currentBatchSize <= maxParticipants) {
    const result = await createGroupWithBatch(
      creator,
      allWorkers,
      currentBatchSize,
      installationsPerUser,
    );

    results.push({
      batchSize: currentBatchSize,
      ...result,
    });

    currentBatchSize += batchIncrement;
  }

  return results;
}

/**
 * Adds a member to a group by a worker
 */
export const addMemberByWorker = async (
  groupId: string,
  membertoAdd: string,
  memberWhoAdds: Worker,
): Promise<void> => {
  await memberWhoAdds.client.conversations.syncAll();
  const group =
    await memberWhoAdds.client.conversations.getConversationById(groupId);

  if (!group) {
    console.log(`Group with ID ${groupId} not found`);
    return;
  }

  // Check if member already exists in the group
  const members = await (group as Group).members();
  const memberExists = members.some(
    (member) => member.inboxId.toLowerCase() === membertoAdd.toLowerCase(),
  );

  if (memberExists) {
    console.log(`Member ${membertoAdd} already exists in group ${groupId}`);
    return;
  }

  // Add member if they don't exist
  await (group as Group).addMembers([membertoAdd]);
  console.log(`Added member ${membertoAdd} to group ${groupId}`);
};

/**
 * Gets or creates a group
 */
export const getOrCreateGroup = async (
  testConfig: {
    testName: string;
  },
  creator: Client,
): Promise<Conversation | undefined> => {
  let globalGroup: Conversation | undefined;
  const GROUP_ID = process.env.GROUP_ID;

  if (!GROUP_ID) {
    globalGroup = await creator.conversations.newGroup([]);
    console.log("Creating group with ID:", globalGroup.id);
    console.log("Updated test config with group ID:", globalGroup.id);

    // Write the group ID to the .env file
    appendToEnv("GROUP_ID", globalGroup.id, testConfig.testName);
  } else {
    globalGroup = await creator.conversations.getConversationById(GROUP_ID);
  }

  return globalGroup;
};

/**
 * Checks if groups across workers are in a forked state
 * Returns true if a fork is detected (different group states)
 */
export const checkForGroupFork = async (
  workers: Worker[],
  groupId: string,
): Promise<boolean> => {
  console.log(`Checking for group fork in group ${groupId}`);

  if (workers.length < 2) {
    console.log("Need at least 2 workers to check for a fork");
    return false;
  }

  const groupStates: Record<string, any> = {};

  // Get group state from each worker
  for (const worker of workers) {
    try {
      const group =
        await worker.client.conversations.getConversationById(groupId);

      if (!group) {
        console.log(`Group not found for worker ${worker.name}`);
        continue;
      }

      // In a real implementation, we would extract the epoch or other state
      // information that would indicate a fork. For now, we'll use what's available
      // in the public API.
      const members = await (group as Group).members();
      const memberCount = members.length;

      // Store group state for this worker
      groupStates[worker.name] = {
        memberCount,
        name: (group as Group).name,
        description: (group as Group).description,
      };

      console.log(
        `${worker.name} group state:`,
        JSON.stringify(groupStates[worker.name]),
      );
    } catch (error) {
      console.error(`Error getting group state for ${worker.name}:`, error);
    }
  }

  // Compare group states to detect forks
  const workerNames = Object.keys(groupStates);
  if (workerNames.length < 2) {
    console.log("Not enough group states to compare");
    return false;
  }

  const firstWorkerState = groupStates[workerNames[0]];
  let forkDetected = false;

  // Compare each worker's state with the first worker
  for (let i = 1; i < workerNames.length; i++) {
    const currentWorkerState = groupStates[workerNames[i]];

    // Compare number of members - a common fork symptom
    if (currentWorkerState.memberCount !== firstWorkerState.memberCount) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has ${firstWorkerState.memberCount} members, but ${workerNames[i]} has ${currentWorkerState.memberCount} members`,
      );
      forkDetected = true;
    }

    // Compare group name
    if (currentWorkerState.name !== firstWorkerState.name) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has group name "${firstWorkerState.name}", but ${workerNames[i]} has "${currentWorkerState.name}"`,
      );
      forkDetected = true;
    }

    // Compare group description
    if (currentWorkerState.description !== firstWorkerState.description) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has description "${firstWorkerState.description}", but ${workerNames[i]} has "${currentWorkerState.description}"`,
      );
      forkDetected = true;
    }
  }

  if (!forkDetected) {
    console.log("No group fork detected - all clients have consistent state");
  }

  return forkDetected;
};

export async function getWorkersFromGroup(
  group: Conversation,
  workers: WorkerManager,
): Promise<Worker[]> {
  await group.sync();
  const members = await group.members();
  const memberInboxIds = members.map((member) => member.inboxId);

  // Use the getWorkers method to retrieve all workers
  const allWorkers = workers.getWorkers();

  // Find workers whose client inboxId matches the group members' inboxIds
  const workersFromGroup = allWorkers.filter((worker) =>
    memberInboxIds.includes(worker.client.inboxId),
  );

  return workersFromGroup;
}
