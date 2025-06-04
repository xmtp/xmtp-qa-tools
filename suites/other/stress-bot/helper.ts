import { type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { getInboxIds, sleep } from "dev/helpers/utils";

/**
 * Gets workers that are members of a group
 */
export async function getWorkersFromGroup(
  group: Conversation,
  workers: WorkerManager,
): Promise<Worker[]> {
  await group.sync();
  const memberIds = (await group.members()).map((m) => m.inboxId);
  return workers.getAll().filter((w) => memberIds.includes(w.client.inboxId));
}

export interface StressTestConfig {
  largeGroups: number[];
  workerCount: number;
  messageCount: number;
  groupCount: number;
  sizeLabel: string;
}

// Predefined test configurations
export const TEST_CONFIGS: Record<string, StressTestConfig> = {
  small: {
    largeGroups: [50],
    workerCount: 10,
    messageCount: 5,
    groupCount: 5,
    sizeLabel: "small",
  },
  medium: {
    largeGroups: [50, 100],
    workerCount: 30,
    messageCount: 10,
    groupCount: 3,
    sizeLabel: "medium",
  },
  large: {
    largeGroups: [50, 100, 200],
    workerCount: 50,
    messageCount: 15,
    groupCount: 5,
    sizeLabel: "large",
  },
};

export async function createAndSendDms(
  workers: WorkerManager,
  receiverInboxId: string,
  messageCount: number,
) {
  let successCount = 0;
  let errorCount = 0;

  for (const sender of workers.getAll()) {
    try {
      await sender.client.conversations.sync();
      console.debug(
        "sender",
        sender.name,
        "is going to send",
        messageCount,
        "messages",
      );
      const dm = await sender.client.conversations.newDm(receiverInboxId);
      for (let i = 0; i < messageCount; i++) {
        await dm.send("hello");
      }
      successCount++;
    } catch (error) {
      console.error(`Error with sender ${sender.name}:`, error);
      errorCount++;
      // Continue with next sender instead of throwing
    }
  }

  console.debug(
    `DM sending completed: ${successCount} succeeded, ${errorCount} failed`,
  );
  return { success: successCount > 0, successCount, errorCount };
}

export async function createAndSendInGroup(
  workers: WorkerManager,
  client: Client,
  groupCount: number,
  receiverInboxId: string,
  conversation: Conversation,
) {
  const allInboxIds = workers.getAllButCreator().map((w) => w.client.inboxId);
  allInboxIds.push(receiverInboxId);

  for (let i = 0; i < groupCount; i++) {
    try {
      const groupName = `Test Group ${i} ${allInboxIds.length}: ${new Date().toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      )}`;
      const group = await client.conversations.newGroup([], {
        groupName,
        groupDescription: "Test group for stress testing",
      });
      for (const inboxId of allInboxIds) {
        try {
          await group.addMembers([inboxId]);
        } catch (error) {
          console.error(
            `Error adding member ${inboxId} to group ${group.id}:`,
            error,
          );
        }
      }
      await group.sync();
      await group.send(`Hello from the group! ${i}`);
      await conversation.send(
        `✅ Successfully created group ${groupName} with ${allInboxIds.length} members`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  return true;
}

export async function createLargeGroup(
  client: Client,
  memberCount: number,
  receiverInboxId: string,
): Promise<Group | undefined> {
  try {
    const MAX_BATCH_SIZE = 10;
    const initialMembers = getInboxIds(1);

    initialMembers.push(receiverInboxId);

    const groupName = `Large Group ${memberCount}: ${initialMembers.length}`;
    const group = await client.conversations.newGroup(initialMembers, {
      groupName,
      groupDescription: `Test group with ${memberCount} members`,
    });

    await group.sync();

    for (let i = 1; i < memberCount; i += MAX_BATCH_SIZE) {
      const endIdx = Math.min(i + MAX_BATCH_SIZE, memberCount);
      const batchMembers = getInboxIds(endIdx - i);

      if (batchMembers.length > 0) {
        await group.addMembers(batchMembers);
        await group.sync();
        await sleep(500);
      }
    }

    await group.send(`Hello from the group with ${memberCount} members`);
    return group as Group;
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
