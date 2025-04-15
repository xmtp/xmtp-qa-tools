import { type Worker, type WorkerManager } from "@workers/manager";

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
