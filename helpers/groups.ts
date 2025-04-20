import { type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";

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
