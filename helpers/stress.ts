import generatedInboxes from "@helpers/generated-inboxes.json";
import type { WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";

export const TEST_CONFIGS: Record<string, StressTestConfig> = {
  small: {
    largeGroups: [50],
    workerCount: 20,
    messageCount: 5,
    groupCount: 5,
    sizeLabel: "small",
  },
  medium: {
    largeGroups: [50, 100],
    workerCount: 50,
    messageCount: 10,
    groupCount: 10,
    sizeLabel: "medium",
  },
  large: {
    largeGroups: [50, 100, 200],
    workerCount: 100,
    messageCount: 15,
    groupCount: 15,
    sizeLabel: "large",
  },
};

// Constants for stress test configurations
export interface StressTestConfig {
  largeGroups: number[];
  workerCount: number;
  messageCount: number;
  groupCount: number;
  sizeLabel: string;
}

/**
 * Create a direct message and send multiple messages
 */
export async function createAndSendDms(
  workers: WorkerManager,
  receiverInboxId: string,
  messageCount: number,
) {
  try {
    for (const sender of workers.getWorkers()) {
      await sender.client.conversations.sync();
      // Create a DM
      const dm = await sender.client.conversations.newDm(receiverInboxId);
      // Send messages
      for (let i = 0; i < messageCount; i++) {
        await dm.send("hello");
      }
    }
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in createAndSendDms:", errorMessage);
    throw error;
  }
}

/**
 * Create a group with all workers as members
 */
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
      // Create a group
      const groupName = `Test Group ${Date.now()}`;
      const group = await creator.client.conversations.newGroup(allInboxIds, {
        groupName,
        groupDescription: "Test group for stress testing",
      });

      await group.send(`Hello from the group! ${i}`);
    }
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in createAndSendInGroup:", errorMessage);
    throw error;
  }
}

/**
 * Create a large group with many members
 */
export async function createLargeGroup(
  workers: WorkerManager,
  memberCount: number,
  receiverInboxId: string,
): Promise<Group | undefined> {
  try {
    const initialMembers = generatedInboxes
      .slice(0, memberCount)
      .map((entry) => entry.inboxId);

    initialMembers.push(receiverInboxId);
    const creator = workers.getWorkers()[0];
    const group = await creator.client.conversations.newGroup(initialMembers, {
      groupName: `Test Group  ${Date.now()}`,
      groupDescription: `Test group with ${memberCount} members`,
    });

    // Ensure group is synced
    await group.sync();
    await group.send(`Hello from the group with ${memberCount} members`);
    return group;
  } catch (error) {
    console.error("Error in createLargeGroup:", error);
    throw error;
  }
}

/**
 * Perform various group operations: update name, add/remove members, admin ops
 */
export async function performGroupOperations(workers: WorkerManager) {
  try {
    const creator = workers.getWorkers()[0];
    const memberInboxIds = workers
      .getWorkers()
      .slice(1, 5)
      .map((w) => w.client.inboxId);

    // Create a group
    const initialGroupName = `Test Group ${Date.now()}`;
    const group = await creator.client.conversations.newGroup(memberInboxIds, {
      groupName: initialGroupName,
      groupDescription: "Test group for operations testing",
    });

    // Update group name
    const updatedGroupName = `Updated Group ${Date.now()}`;
    await group.updateName(updatedGroupName);
    await group.sync();

    // Add a member
    const newMemberWorker = workers.getWorkers()[5];
    await group.addMembers([newMemberWorker.client.inboxId]);

    // Make a member an admin
    const memberToPromote = workers.getWorkers()[1];
    await group.addAdmin(memberToPromote.client.inboxId);

    // Remove a member
    const memberToRemove = workers.getWorkers()[2];
    await group.removeMembers([memberToRemove.client.inboxId]);

    // Update group description
    const updatedDescription = "Updated description";
    await group.updateDescription(updatedDescription);
    await group.sync();

    return group;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in performGroupOperations:", errorMessage);
    throw error;
  }
}

/**
 * Send DMs from all workers to a specific recipient
 */
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

/**
 * Create groups with workers and send messages
 */
export async function createGroupsWithWorkers(
  workers: WorkerManager,
  client: Client,
  config: StressTestConfig,
  senderInboxId?: string,
  conversation?: Conversation,
) {
  const workerInboxIds = workers
    .getWorkers()
    .map((w) => w.client?.inboxId)
    .filter(Boolean);

  for (let i = 0; i < config.groupCount; i++) {
    try {
      console.log(`Creating group ${i + 1} of ${config.groupCount}`);
      // First create with a subset of members (up to max batch size)
      const initialMembers = [...workerInboxIds];
      if (senderInboxId) {
        initialMembers.push(senderInboxId);
      }

      // Create group with all members at once
      const group = await client.conversations.newGroup(initialMembers, {
        groupName: `Stress Test Group ${i + 1}`,
        groupDescription: `Group created for stress testing with ${workerInboxIds.length} members`,
      });

      if (!group) {
        console.error(`Failed to create group ${i + 1}`);
        continue;
      }

      // Wait for group to sync
      await group.sync();

      // Send a welcome message to the group
      await group.send(
        `Hello from the group ${i + 1}! This group has ${workerInboxIds.length} members.`,
      );

      console.log(
        `Successfully created and sent message to group ${i + 1} (ID: ${group.id})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error creating group ${i + 1}: ${errorMessage}`);
    }
  }

  if (conversation) {
    await conversation.send(
      `✅ ${config.groupCount} groups created with ${workerInboxIds.length} members each`,
    );
  }
}

/**
 * Create large groups based on config sizes
 */
export async function createLargeGroups(
  config: StressTestConfig,
  workers: WorkerManager,
  receiverInboxId: string,
  conversation?: Conversation,
) {
  // Create the group based on the selected size
  for (const size of config.largeGroups) {
    if (conversation) {
      await conversation.send(`Creating group with ${size} members...`);
    }

    const group = await createLargeGroup(workers, size, receiverInboxId);

    if (!group) {
      throw new Error(`Failed to create group with ${size} members`);
    }

    console.log(`Created group with ${size} members`);

    if (conversation) {
      await conversation.send(`📨 Sending messages to group ${group.id}...`);
    }
  }
  return true;
}
