import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type Dm,
  type Group,
} from "@xmtp/node-sdk";

const testName = "stress-bot";
loadEnv(testName);

// Constants
const HELP_TEXT = `Stress bot commands:
/stress <size> - Start a stress test with predefined parameters

Size options:
- small: Creates a group with 20 members, 3 workers, 5 messages each
- medium: Creates a group with 50 members, 5 workers, 10 messages each
- large: Creates a group with 100 members, 10 workers, 15 messages each

Examples:
/stress small - Run a small test ~ 20 conversations
/stress medium - Run a medium test ~ 50 conversations
/stress large - Run a large test ~ 100 conversations`;

let isStressTestRunning = false;
let workers: WorkerManager | undefined;

// Group size configuration with hardcoded test parameters

interface StressTestConfig {
  workerCount: number;
  messageCount: number;
  groupCount: number;
  sizeLabel: string;
}

const TEST_CONFIGS: Record<string, StressTestConfig> = {
  small: {
    workerCount: 20,
    messageCount: 5,
    groupCount: 5,
    sizeLabel: "small",
  },
  medium: {
    workerCount: 50,
    messageCount: 10,
    groupCount: 10,
    sizeLabel: "medium",
  },
  large: {
    workerCount: 100,
    messageCount: 15,
    groupCount: 15,
    sizeLabel: "large",
  },
};

async function initializeBot() {
  const botWorker = await getWorkers(["bot"], testName, "none");
  const bot = botWorker.get("bot");
  console.log("Bot worker:", bot?.address);
  console.log("Bot worker client:", bot?.client.inboxId);
  return bot?.client as Client;
}

function parseStressCommand(args: string[]): StressTestConfig | null {
  if (args.length < 2) return null;

  const sizeArg = args[1].toLowerCase();
  if (!["small", "medium", "large"].includes(sizeArg)) return null;

  const config = TEST_CONFIGS[sizeArg];
  return {
    workerCount: config.workerCount,
    messageCount: config.messageCount,
    groupCount: config.groupCount,
    sizeLabel: sizeArg,
  };
}

async function sendWorkerMessagesToGroup(
  workers: WorkerManager,
  groupId: string,
  messageCount: number,
): Promise<void> {
  const sendPromises: Promise<void>[] = [];

  for (const worker of workers.getWorkers()) {
    if (!worker.client) continue;

    const sendPromise = (async () => {
      try {
        // Make sure worker has synced conversations
        await worker.client.conversations.sync();

        // Get the group conversation
        const groupFromWorker =
          await worker.client.conversations.getConversationById(groupId);

        if (!groupFromWorker) {
          console.error(
            `[${worker.name}] Failed to find group with ID ${groupId}`,
          );
          return;
        }

        // Send messages
        for (let i = 0; i < messageCount; i++) {
          try {
            await groupFromWorker.send(
              `Group Test ${worker.name} - ${i + 1}/${messageCount}`,
            );
            console.log(
              `[${worker.name}] Sent message ${i + 1} to group ${groupId}`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[${worker.name}] Error sending message ${i + 1} to group: ${errorMessage}`,
            );
          }

          // Add a small delay between messages to avoid rate limiting
          if (i < messageCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[${worker.name}] Error in sendWorkerMessagesToGroup: ${errorMessage}`,
        );
      }
    })();

    sendPromises.push(sendPromise);
  }

  // Wait for all workers to finish sending messages
  await Promise.all(sendPromises);
}

async function createLargeGroup(
  workers: WorkerManager,
  memberCount: number,
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<string | undefined> {
  if (generatedInboxes.length < memberCount) {
    await conversation.send(
      `⚠️ Not enough inboxes for ${memberCount}-member group`,
    );
    return undefined;
  }

  await conversation.send(`⏳ Creating group with ${memberCount} members...`);

  // Prepare valid inbox IDs, filtering out any undefined values
  const inboxes = generatedInboxes
    .slice(0, memberCount)
    .map((entry) => entry.inboxId)
    .filter(Boolean);

  const workerInboxes = workers
    .getWorkers()
    .map((w) => w.client?.inboxId)
    .filter(Boolean);

  try {
    const maxMembersPerBatch = 50;
    let group;
    const groupName = `Large Group ${memberCount} - ${Date.now()}`;
    const groupDescription = `Test group with ${memberCount} members`;

    // Always include message sender in initial members
    if (memberCount > maxMembersPerBatch) {
      // First create with a subset of members (up to max batch size)
      const initialMembers = [
        ...inboxes.slice(0, maxMembersPerBatch - 1),
        message.senderInboxId,
      ];

      group = await client.conversations.newGroup(initialMembers, {
        groupName,
        groupDescription,
      });

      // Log initial group creation
      console.log(
        `Created group ${group.id} with ${initialMembers.length} initial members`,
      );
      await conversation.send(
        `⏳ Created group with ${initialMembers.length} initial members. Adding more in batches...`,
      );

      // Add remaining members in batches
      const remainingInboxes = inboxes.slice(maxMembersPerBatch - 1);
      const workerInboxesToAdd = workerInboxes.filter(
        (id) => !initialMembers.includes(id),
      );
      const allRemainingInboxes = [...remainingInboxes, ...workerInboxesToAdd];

      // Process batches
      for (let i = 0; i < allRemainingInboxes.length; i += maxMembersPerBatch) {
        const batch = allRemainingInboxes.slice(i, i + maxMembersPerBatch);

        if (batch.length === 0) continue;

        await conversation.send(
          `⏳ Adding batch of ${batch.length} members (${i + 1}-${i + batch.length})...`,
        );

        try {
          await group.addMembers(batch);
          console.log(
            `Added batch of ${batch.length} members to group ${group.id}`,
          );

          // Give some time between batches to avoid rate limiting
          if (i + maxMembersPerBatch < allRemainingInboxes.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`Error adding batch to group: ${errorMessage}`);
          await conversation.send(`⚠️ Error adding batch: ${errorMessage}`);
        }
      }
    } else {
      // For smaller groups, create with all members at once
      const allMembers = [...inboxes, ...workerInboxes, message.senderInboxId];
      group = await client.conversations.newGroup(allMembers, {
        groupName,
        groupDescription,
      });
    }

    // Ensure group is synced
    await group.sync();

    // Get the actual member count
    const members = await group.members();

    await conversation.send(
      `✅ Created group with ${members.length} members, ID: ${group.id}`,
    );

    // Try to send one test message from the creator
    await group.send(
      `Welcome to the group! This is a test group with ${members.length} members.`,
    );

    return group.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await conversation.send(`❌ Error creating large group: ${errorMessage}`);
    return undefined;
  }
}

async function runStressTest(
  config: StressTestConfig,
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
) {
  const startTime = Date.now();
  isStressTestRunning = true;

  try {
    await conversation.send("🚀 Initializing workers...");
    workers = await getWorkers(config.workerCount, testName, "message", "gm");

    // // Send DMs from workers
    // await sendDmsFromWorkers(workers, message.senderInboxId, conversation);

    // Create groups with workers and send messages to them
    await createGroupsWithWorkers(workers, client, conversation, config);

    // // Create large groups
    // await createLargeGroups(config, workers, client, conversation, message);
  } catch (error) {
    console.error("Error during stress test:", error);
  } finally {
    isStressTestRunning = false;
  }
}

async function sendDmsFromWorkers(
  workers: WorkerManager,
  senderInboxId: string,
  conversation: Conversation,
) {
  for (const worker of workers.getWorkers()) {
    const dm = await worker.client?.conversations.newDm(senderInboxId);
    await dm?.send(`sup! ${worker.name} here`);
  }
  await conversation.send(`✅ DMs sent from ${workers.getLength()} workers`);
}

async function createGroupsWithWorkers(
  workers: WorkerManager,
  client: Client,
  conversation: Conversation,
  config: StressTestConfig,
) {
  const workerInboxIds = workers
    .getWorkers()
    .map((w) => w.client?.inboxId)
    .filter(Boolean);

  for (let i = 0; i < config.groupCount; i++) {
    try {
      console.log(`Creating group ${i + 1} of ${config.groupCount}`);

      // Create group with all members at once instead of creating empty group then adding members
      const group = await client.conversations.newGroup(workerInboxIds, {
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

  await conversation.send(
    `✅ ${config.groupCount} groups created with ${workerInboxIds.length} members each`,
  );
}

async function createLargeGroups(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
) {
  const sizes = ["50", "100", "150"];
  // Create the group based on the selected size
  for (const size of sizes) {
    const groupId = await createLargeGroup(
      workers,
      parseInt(size),
      client,
      conversation,
      message,
    );
    if (!groupId) {
      throw new Error(`Failed to create group with ${size} members`);
    }
    console.log(`Created group with ${size} members`);

    // Send messages to the group
    await conversation.send(`📨 Sending messages to group ${groupId}...`);
    await sendWorkerMessagesToGroup(workers, groupId, config.messageCount);

    const totalMessages = config.workerCount * config.messageCount;
    await conversation.send(`✅ Sent ${totalMessages} messages to group`);
  }
}
async function handleMessage(
  message: DecodedMessage,
  conversation: Dm | Group,
  client: Client,
) {
  const content = message.content as string;
  const args = content.split(" ");
  const command = args[0].toLowerCase();

  // Handle commands
  switch (command) {
    case "/stress": {
      if (isStressTestRunning) {
        await conversation.send(
          "⚠️ A stress test is already running. Please either:\n" +
            "1. Wait for it to complete, or\n" +
            "2. Use `/stress reset` to force stop all tests",
        );
        return;
      }

      const config = parseStressCommand(args);
      if (config) {
        await runStressTest(config, message, conversation, client);
      } else {
        await conversation.send(
          "⚠️ Invalid command format. Use /stress <size>\n" +
            "Size options: small, medium, or large",
        );
      }
      break;
    }
    default:
      await conversation.send(HELP_TEXT);
  }
}

async function main() {
  try {
    const client = await initializeBot();
    await client.conversations.sync();
    const stream = client.conversations.streamAllMessages();

    for await (const message of await stream) {
      try {
        // Skip own messages and non-text messages
        if (
          message?.senderInboxId.toLowerCase() ===
            client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        )
          continue;

        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        if (!conversation) continue;

        await handleMessage(message, conversation, client);
      } catch (error) {
        // Silent error handling for message processing
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
