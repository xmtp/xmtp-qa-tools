import generatedInboxes from "@helpers/generated-inboxes.json";
import { type Worker, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";

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

export const TEST_CONFIGS: Record<string, StressTestConfig> = {
  small: {
    largeGroups: [10],
    workerCount: 20,
    messageCount: 5,
    groupCount: 2,
    sizeLabel: "small",
  },
  medium: {
    largeGroups: [15, 20],
    workerCount: 50,
    messageCount: 10,
    groupCount: 3,
    sizeLabel: "medium",
  },
  large: {
    largeGroups: [20, 30, 40],
    workerCount: 100,
    messageCount: 15,
    groupCount: 5,
    sizeLabel: "large",
  },
};

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
  groupCount: number,
  receiverInboxId: string,
) {
  try {
    const allInboxIds = workers.getWorkers().map((w) => w.client.inboxId);
    allInboxIds.push(receiverInboxId);

    for (let i = 0; i < groupCount; i++) {
      let creator = workers.getWorkers()[0];
      const groupName = `Test Group ${Date.now()}`;
      const group = await creator.client.conversations.newGroup(allInboxIds, {
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
  workers: WorkerManager,
  memberCount: number,
  receiverInboxId: string,
): Promise<Group | undefined> {
  try {
    const MAX_BATCH_SIZE = 10;
    const initialMembers = generatedInboxes
      .slice(0, 1)
      .map((entry) => entry.inboxId);

    initialMembers.push(receiverInboxId);

    const creator = workers.getWorkers()[0];
    const group = await creator.client.conversations.newGroup(initialMembers, {
      groupName: `Large Group ${Date.now()}`,
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

export async function sendDmsFromWorkers(
  workers: WorkerManager,
  senderInboxId: string,
  conversation?: Conversation,
) {
  for (const worker of workers.getWorkers()) {
    if (!worker.client) continue;
    const dm = await worker.client.conversations.newDm(senderInboxId);
    await dm.send(`sup! ${worker.name} here`);
  }

  if (conversation) {
    await conversation.send(`✅ DMs sent from ${workers.getLength()} workers`);
  }
}

export async function createGroupsWithWorkers(
  workers: WorkerManager,
  client: Client,
  config: StressTestConfig,
  receiverInboxId: string | DecodedMessage,
) {
  const workerInboxIds = workers
    .getWorkers()
    .map((w) => w.client?.inboxId)
    .filter(Boolean);

  const inboxId =
    typeof receiverInboxId === "string"
      ? receiverInboxId
      : receiverInboxId.senderInboxId;

  const MAX_BATCH_SIZE = 10;

  for (let i = 0; i < config.groupCount; i++) {
    try {
      const initialMembers = workerInboxIds.slice(0, 1);
      initialMembers.push(inboxId);

      let group;
      try {
        group = await client.conversations.newGroup(initialMembers, {
          groupName: `Stress Test Group ${i + 1}`,
          groupDescription: `Stress test group created at ${new Date().toISOString()}`,
        });
      } catch (botClientError) {
        const fallbackWorker = workers.getWorkers()[0];
        if (!fallbackWorker || !fallbackWorker.client) {
          throw new Error("No fallback worker available");
        }

        const workerInitialMembers = [client.inboxId, inboxId];

        group = await fallbackWorker.client.conversations.newGroup(
          workerInitialMembers,
          {
            groupName: `Stress Test Group ${i + 1} (Worker Created)`,
            groupDescription: `Stress test group created at ${new Date().toISOString()} using worker client`,
          },
        );
      }

      await group.sync();

      const groupMembers = await group.members();
      const groupMemberInboxIds = groupMembers.map((m) =>
        m.inboxId.toLowerCase(),
      );

      const remainingWorkers = workerInboxIds.filter(
        (id) => !groupMemberInboxIds.includes(id.toLowerCase()),
      );

      if (remainingWorkers.length > 0) {
        for (let j = 0; j < remainingWorkers.length; j += MAX_BATCH_SIZE) {
          const batchMembers = remainingWorkers.slice(j, j + MAX_BATCH_SIZE);
          if (batchMembers.length > 0) {
            try {
              await group.addMembers(batchMembers);
              await group.sync();
            } catch (addError) {
              // Continue with next batch
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      await group.send(
        `Hello from stress test! This is group ${i + 1} of ${config.groupCount}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      // Continue with next group
    }
  }
}

export async function createLargeGroups(
  config: StressTestConfig,
  workers: WorkerManager,
  receiverInboxId: string,
  conversation?: Conversation,
) {
  for (const size of config.largeGroups) {
    try {
      if (conversation) {
        await conversation.send(`Creating group with ${size} members...`);
      }

      const group = await createLargeGroup(workers, size, receiverInboxId);

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
