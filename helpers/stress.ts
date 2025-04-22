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
    console.log(allInboxIds.length);

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

    const allWorkersInboxes = workers.getWorkers().map((w) => w.client.inboxId);
    allWorkersInboxes.push(receiverInboxId);
    const creator = workers.getWorkers()[0];
    const group = await creator.client.conversations.newGroup(
      allWorkersInboxes,
      {
        groupName: `Test Group  ${Date.now()}`,
        groupDescription: `Test group with ${memberCount} members`,
      },
    );

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

/**
 * Run a complete stress test based on configuration
 */
export async function runStressTest(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  receiverInboxId: string,
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
    await createLargeGroups(config, workers, receiverInboxId, conversation);

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
