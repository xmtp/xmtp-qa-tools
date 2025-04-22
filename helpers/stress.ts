import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";

// Constants for stress test configurations
export interface StressTestConfig {
  largeGroups: number[];
  workerCount: number;
  messageCount: number;
  groupCount: number;
  sizeLabel: string;
}

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
export const HELP_TEXT = `Stress bot commands:
/stress <size> - Start a stress test with predefined parameters

Size options:
- small: Creates a group with 20 members, 3 workers, 5 messages each
- medium: Creates a group with 50 members, 5 workers, 10 messages each
- large: Creates a group with 100 members, 10 workers, 15 messages each

Examples:
/stress small - Run a small test ~ 20 conversations
/stress medium - Run a medium test ~ 50 conversations
/stress large - Run a large test ~ 100 conversations`;

/**
 * Create a direct message and send multiple messages
 */
export async function createAndSendDms(
  workers: WorkerManager,
  receiverInboxId: string,
  messageCount: number,
) {
  try {
    const sender = workers.getWorkers()[0];
    console.log(sender.inboxId, receiverInboxId);
    // Create a DM
    const dm = await sender.client.conversations.newDm(receiverInboxId);

    // Send messages
    for (let i = 0; i < messageCount; i++) {
      const message = `Test message ${i + 1}/${messageCount}`;
      await dm.send(message);
    }

    return dm;
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
  messageCount: number,
) {
  try {
    const creator = workers.getWorkers()[0];
    const allInboxIds = workers.getWorkers().map((w) => w.client.inboxId);

    // Create a group
    const groupName = `Test Group ${Date.now()}`;
    const group = await creator.client.conversations.newGroup(allInboxIds, {
      groupName,
      groupDescription: "Test group for stress testing",
    });

    // Send messages to the group
    for (let i = 0; i < messageCount; i++) {
      const message = `Group message ${i + 1}/${messageCount}`;
      await group.send(message);
    }

    return group;
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
  creator: Client,
  memberCount: number,
  conversation?: Conversation,
  senderInboxId?: string,
): Promise<Group | undefined> {
  try {
    if (generatedInboxes.length < memberCount) {
      if (conversation) {
        await conversation.send(
          `⚠️ Not enough inboxes for ${memberCount}-member group`,
        );
      }
      return undefined;
    }

    if (conversation) {
      await conversation.send(
        `⏳ Creating group with ${memberCount} members...`,
      );
    }

    // Prepare valid inbox IDs from generated inboxes
    const inboxes = generatedInboxes
      .slice(0, memberCount)
      .map((entry) => entry.inboxId)
      .filter(Boolean);

    const maxMembersPerBatch = 50;
    let group: Group;
    const groupName = `Large Group ${memberCount} - ${Date.now()}`;

    if (memberCount > maxMembersPerBatch) {
      // Create with initial batch of members
      const initialMembers = [...inboxes.slice(0, maxMembersPerBatch - 1)];
      if (senderInboxId) {
        initialMembers.push(senderInboxId);
      }

      group = await creator.conversations.newGroup(initialMembers, {
        groupName,
        groupDescription: `Test group with ${memberCount} members`,
      });

      console.log(
        `Created group with ${initialMembers.length} initial members`,
      );

      if (conversation) {
        await conversation.send(
          `⏳ Created group with ${initialMembers.length} initial members. Adding more in batches...`,
        );
      }

      // Add remaining members in batches
      const remainingInboxes = inboxes.slice(maxMembersPerBatch - 1);

      for (let i = 0; i < remainingInboxes.length; i += maxMembersPerBatch) {
        const batch = remainingInboxes.slice(i, i + maxMembersPerBatch);
        if (batch.length === 0) continue;

        console.log(
          `Adding batch of ${batch.length} members (${i + 1}-${i + batch.length})...`,
        );

        if (conversation) {
          await conversation.send(
            `⏳ Adding batch of ${batch.length} members (${i + 1}-${i + batch.length})...`,
          );
        }

        try {
          await group.addMembers(batch);

          // Give some time between batches to avoid rate limiting
          if (i + maxMembersPerBatch < remainingInboxes.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`Error adding batch to group: ${errorMessage}`);
          if (conversation) {
            await conversation.send(`⚠️ Error adding batch: ${errorMessage}`);
          }
        }
      }
    } else {
      // For smaller groups, create with all members at once
      const allMembers = [...inboxes];
      if (senderInboxId) {
        allMembers.push(senderInboxId);
      }

      group = await creator.conversations.newGroup(allMembers, {
        groupName,
        groupDescription: `Test group with ${memberCount} members`,
      });
    }

    // Ensure group is synced
    await group.sync();

    // Get the actual member count
    const members = await group.members();
    console.log(
      `Created group with ${members.length} members, ID: ${group.id}`,
    );

    if (conversation) {
      await conversation.send(
        `✅ Created group with ${members.length} members, ID: ${group.id}`,
      );

      // Send a test message
      await group.send(
        `Welcome to the group! This is a test group with ${members.length} members.`,
      );
    }

    return group;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in createLargeGroup:", errorMessage);
    if (conversation) {
      await conversation.send(`❌ Error creating large group: ${errorMessage}`);
    }
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
 * Set up and test message streaming
 */
export async function testMessageStreaming(
  workers: WorkerManager,
  messageCount: number = 3,
  timeoutMs: number = 10000,
): Promise<boolean> {
  try {
    const sender = workers.getWorkers()[0];
    const receiver = workers.getWorkers()[1];

    // Create a DM
    const dm = await sender.client.conversations.newDm(receiver.client.inboxId);

    // Set up streaming for the receiver
    let receivedCount = 0;

    // Start the message stream
    const streamPromise = new Promise<boolean>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout waiting for streamed messages"));
      }, timeoutMs);

      void (async () => {
        try {
          await receiver.client.conversations.sync();
          const stream =
            await receiver.client.conversations.streamAllMessages();

          for await (const message of stream) {
            if (
              message &&
              message.conversationId === dm.id &&
              message.senderInboxId.toLowerCase() ===
                sender.client.inboxId.toLowerCase()
            ) {
              receivedCount++;
              console.log(`Received message: ${String(message.content)}`);

              if (receivedCount >= messageCount) {
                clearTimeout(timeoutId);
                resolve(true);
                break;
              }
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(
            new Error(error instanceof Error ? error.message : String(error)),
          );
        }
      })();
    });

    // Send messages
    for (let i = 0; i < messageCount; i++) {
      await dm.send(`Stream test message ${i + 1}`);
      // Add a small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Wait for the stream to receive all messages
    return await streamPromise;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in testMessageStreaming:", errorMessage);
    throw error;
  }
}

/**
 * Send worker messages to a specific group
 */
export async function sendWorkerMessagesToGroup(
  workers: WorkerManager,
  groupId: string,
  messageCount: number,
): Promise<void> {
  const sendPromises = workers
    .getWorkers()
    .map(async (worker) => {
      if (!worker.client) return;

      await worker.client.conversations.sync();
      const group =
        await worker.client.conversations.getConversationById(groupId);

      if (!group) {
        console.error(
          `[${worker.name}] Failed to find group with ID ${groupId}`,
        );
        return;
      }

      for (let i = 0; i < messageCount; i++) {
        await group.send(
          `Group Test ${worker.name} - ${i + 1}/${messageCount}`,
        );
      }
    })
    .filter(Boolean);

  await Promise.all(sendPromises);
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
  client: Client,
  conversation?: Conversation,
  message?: DecodedMessage,
) {
  // Create the group based on the selected size
  for (const size of config.largeGroups) {
    if (conversation) {
      await conversation.send(`Creating group with ${size} members...`);
    }

    const group = await createLargeGroup(
      client,
      size,
      conversation,
      message?.senderInboxId,
    );

    if (!group) {
      throw new Error(`Failed to create group with ${size} members`);
    }

    console.log(`Created group with ${size} members`);

    if (conversation) {
      // Send messages to the group
      await conversation.send(`📨 Sending messages to group ${group.id}...`);
    }

    await sendWorkerMessagesToGroup(workers, group.id, config.messageCount);

    if (conversation) {
      const totalMessages = config.workerCount * config.messageCount;
      await conversation.send(`✅ Sent ${totalMessages} messages to group`);
    }
  }
}

/**
 * Run a complete stress test based on configuration
 */
export async function runStressTest(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  conversation?: Conversation,
  message?: DecodedMessage,
) {
  const startTime = Date.now();

  try {
    if (conversation) {
      await conversation.send("🚀 Running stress test...");
    }

    // Send DMs from workers to sender (if message provided)
    if (message && conversation) {
      await sendDmsFromWorkers(workers, message.senderInboxId, conversation);
    }

    // Create large groups
    await createLargeGroups(config, workers, client, conversation, message);

    // Create groups with workers and send messages to them
    await createGroupsWithWorkers(
      workers,
      client,
      config,
      message?.senderInboxId,
      conversation,
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (conversation) {
      await conversation.send(
        `✅ Stress test completed in ${duration} seconds!`,
      );
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error during stress test:", errorMessage);

    if (conversation) {
      await conversation.send(`❌ Stress test failed: ${errorMessage}`);
    }

    return false;
  }
}

/**
 * Handle message commands for the stress bot
 */
export async function handleStressCommand(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
  isStressTestRunning: boolean,
): Promise<boolean> {
  const workers = await getWorkers(
    TEST_CONFIGS.small.workerCount,
    "stress",
    "message",
    "gm",
  );
  const content = message.content as string;
  const args = content.split(" ");
  const command = args[0].toLowerCase();

  // Only handle /stress commands
  if (command !== "/stress") {
    await conversation.send(HELP_TEXT);
    return false;
  }

  if (isStressTestRunning) {
    await conversation.send(
      "⚠️ A stress test is already running. Please either:\n" +
        "1. Wait for it to complete, or\n" +
        "2. Use `/stress reset` to force stop all tests",
    );
    return false;
  }

  if (args.length < 2) {
    await conversation.send(HELP_TEXT);
    return false;
  }

  const sizeArg = args[1].toLowerCase();
  if (!["small", "medium", "large"].includes(sizeArg)) {
    await conversation.send(
      "⚠️ Invalid size option. Use 'small', 'medium', or 'large'.\n" +
        HELP_TEXT,
    );
    return false;
  }

  const config = TEST_CONFIGS[sizeArg];
  if (config) {
    return await runStressTest(config, workers, client, conversation, message);
  } else {
    await conversation.send(
      "⚠️ Invalid command format. Use /stress <size>\n" +
        "Size options: small, medium, or large",
    );
    return false;
  }
}
