import generatedInboxes from "@helpers/generated-inboxes.json";
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

export interface StressTestConfig {
  largeGroups: number[];
  workerCount: number;
  messageCount: number;
  groupCount: number;
  sizeLabel: string;
}

export async function createAndSendDms(
  workers: WorkerManager,
  receiverInboxId: string,
  messageCount: number,
) {
  try {
    for (const sender of workers.getWorkers()) {
      await sender.client.conversations.sync();
      const dm = await sender.client.conversations.newDm(receiverInboxId);
      for (let i = 0; i < messageCount; i++) {
        await dm.send("hello");
      }
    }
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function createAndSendInGroup(
  workers: WorkerManager,
  client: Client,
  groupCount: number,
  receiverInboxId: string,
) {
  try {
    const allInboxIds = workers.getWorkers().map((w) => w.client.inboxId);
    allInboxIds.push(receiverInboxId);

    for (let i = 0; i < groupCount; i++) {
      const groupName = `Test Group ${i} ${allInboxIds.length}`;
      const group = await client.conversations.newGroup(allInboxIds, {
        groupName,
        groupDescription: "Test group for stress testing",
      });

      await group.send(`Hello from the group! ${i}`);
    }
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function createLargeGroup(
  client: Client,
  memberCount: number,
  receiverInboxId: string,
): Promise<Group | undefined> {
  try {
    const MAX_BATCH_SIZE = 10;
    const initialMembers = generatedInboxes
      .slice(0, 1)
      .map((entry) => entry.inboxId);

    initialMembers.push(receiverInboxId);

    const groupName = `Large Group ${memberCount}: ${initialMembers.length}`;
    const group = await client.conversations.newGroup(initialMembers, {
      groupName,
      groupDescription: `Test group with ${memberCount} members`,
    });

    await group.sync();

    for (let i = 1; i < memberCount; i += MAX_BATCH_SIZE) {
      const endIdx = Math.min(i + MAX_BATCH_SIZE, memberCount);
      const batchMembers = generatedInboxes
        .slice(i, endIdx)
        .map((entry) => entry.inboxId);

      if (batchMembers.length > 0) {
        await group.addMembers(batchMembers);
        await group.sync();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    await group.send(`Hello from the group with ${memberCount} members`);
    return group;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function createLargeGroups(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  receiverInboxId: string,
  conversation?: Conversation,
) {
  for (const size of config.largeGroups) {
    try {
      if (conversation) {
        await conversation.send(`Creating group with ${size} members...`);
      }

      const group = await createLargeGroup(client, size, receiverInboxId);

      if (!group) {
        if (conversation) {
          await conversation.send(
            `❌ Failed to create group with ${size} members`,
          );
        }
        continue;
      }

      if (conversation) {
        await conversation.send(
          `✅ Successfully created group with ${size} members (ID: ${group.id})`,
        );
        await conversation.send(`📨 Sending messages to group ${group.id}...`);
      }
    } catch (error) {
      if (conversation) {
        await conversation.send(
          `❌ Error creating group with ${size} members: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return true;
}
