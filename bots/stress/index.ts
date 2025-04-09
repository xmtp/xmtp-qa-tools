import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import {
  Dm,
  type Client,
  type Conversation,
  type DecodedMessage,
  type WorkerManager,
} from "@helpers/types";
import { getWorkers } from "@workers/manager";

const testName = "stress-bot";
loadEnv(testName);

// Constants
const HELP_TEXT = `🤖 XMTP Stress Test Bot

Available Commands:
/help - Show this help message
/stress <workers> <messages> - Start a stress test
/stress reset - Reset all workers

Examples:
/stress 5 10 - Create test with 5 workers sending 10 messages each
/stress reset - Terminate all workers and start over

Limits:
- Workers: 1-40`;

let isStressTestRunning = false;
let workers: WorkerManager | undefined;

interface StressTestConfig {
  workerCount: number;
  messageCount: number;
}

// Define the type for generated inboxes
interface GeneratedInbox {
  accountAddress: string;
  inboxId: string;
  privateKey: string;
  encryptionKey: string;
}

async function initializeBot() {
  const botWorker = await getWorkers(["bot"], testName, "none", false);
  const bot = botWorker.get("bot");
  const client = bot?.client as Client;

  console.log(`Agent initialized on address ${bot?.address}`);
  console.log(`Agent initialized on inbox ${client.inboxId}`);
  //console.log(`https://converse.xyz/dm/${client.inboxId}?env=${env}`);

  return client;
}

function parseStressCommand(args: string[]): StressTestConfig | null {
  if (args.length < 2) return null;

  const workerCount = parseInt(args[1]);
  let messageCount = 5; // Default to 5 messages if not specified

  if (isNaN(workerCount) || workerCount < 1 || workerCount > 100) return null;
  if (args[2]) {
    const parsedMessageCount = parseInt(args[2]);
    if (!isNaN(parsedMessageCount) && parsedMessageCount > 0) {
      messageCount = parsedMessageCount;
    }
  }

  return { workerCount, messageCount };
}

/**
 * Sends messages from a worker to a specified group
 * @param worker The worker that will send messages
 * @param groupId ID of the group to send messages to
 * @param messageCount Number of messages to send
 * @param progressCallback Optional callback function to report progress
 * @returns Number of messages successfully sent
 */
async function sendWorkerMessagesToGroup(
  workers: WorkerManager,
  groupId: string,
  messageCount: number,
): Promise<void> {
  for (const worker of workers.getWorkers()) {
    console.log(
      `Worker ${worker.name} sending ${messageCount} messages to group ${groupId}`,
    );
    await worker.client?.conversations.syncAll();
    let messagesSent = 0;
    const groupFromWorker =
      await worker.client?.conversations.getConversationById(groupId);

    for (let i = 0; i < messageCount; i++) {
      await groupFromWorker?.send(
        `Group Test ${worker.name} - ${i + 1}/${messageCount}`,
      );
      messagesSent++;
    }

    console.log(
      `Worker ${worker.name} sent ${messagesSent}/${messageCount} messages to group ${groupId}`,
    );
  }
}

/**
 * Creates a large group with the specified number of members
 * @param memberCount Number of members to include in the group
 * @param client XMTP client used to create the group
 * @param conversation Conversation used to send status updates
 * @param generatedInboxes Array of generated inboxes to use for members
 * @returns The group ID if successful, undefined otherwise
 */
async function createLargeGroup(
  workers: WorkerManager,
  memberCount: number,
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<string | undefined> {
  if (generatedInboxes.length < memberCount) {
    console.log(
      `Not enough pre-generated inboxes for ${memberCount}-member group`,
    );
    await conversation.send(
      `⚠️ Not enough pre-generated inboxes for ${memberCount}-member group`,
    );
    return undefined;
  }

  await conversation.send(`⏳ Creating group with ${memberCount} members...`);

  const inboxes: string[] = generatedInboxes
    .slice(0, memberCount)
    .map((entry: GeneratedInbox) => entry.inboxId);

  const workerInboxes = workers.getWorkers().map((w) => w.client?.inboxId);

  console.log(
    `Creating ${memberCount}-member group with ${inboxes.length} inboxes`,
  );

  try {
    // console.log([...inboxes, client.inboxId, message.senderInboxId]);
    const group = await client.conversations.newGroup(
      [...inboxes, client.inboxId, ...workerInboxes, message.senderInboxId],
      {
        groupName: `Large Group ${memberCount} - ${Date.now()}`,
        groupDescription: `Large group with ${memberCount} members for stress testing`,
      },
    );

    console.log(`Created ${memberCount}-member group with ID: ${group.id}`);
    await conversation.send(
      `✅ Created group with ${memberCount} members, ID: ${group.id}`,
    );

    await sendWorkerMessagesToGroup(workers, group.id, 1);

    return group.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Error creating ${memberCount}-member group: ${errorMessage}`,
    );
    await conversation.send(
      `❌ Error creating ${memberCount}-member group: ${errorMessage}`,
    );
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

    workers = await getWorkers(config.workerCount, testName, "message", true);
    console.log(
      `Successfully initialized ${workers.getWorkers().length} workers`,
    );

    await conversation.send(
      `✅ Successfully initialized ${config.workerCount} workers\n` +
        `📝 Each worker will send:\n` +
        `- ${config.messageCount} DM messages\n` +
        `- ${config.messageCount} group messages\n` +
        `Total expected messages: ${config.workerCount * config.messageCount * 2}`,
    );

    const workerInboxIds = workers
      .getWorkers()
      .map((w) => w.client?.inboxId)
      .filter(Boolean);
    console.log(`Collected ${workerInboxIds.length} worker inbox IDs`);

    // Create group
    await conversation.send("⏳ Creating test group...");
    const group = await client.conversations.newGroup(
      [...workerInboxIds, message.senderInboxId, client.inboxId],
      {
        groupName: `Stress Test Group ${Date.now()}`,
        groupDescription: "Group for stress testing",
      },
    );
    console.log(`Created test group with ID: ${group.id}`);

    await conversation.send("✅ Test group created successfully");

    // Create additional groups with different member counts
    await conversation.send(
      "⏳ Creating additional groups with pre-generated inboxes...",
    );

    console.log(`Loaded ${generatedInboxes.length} pre-generated inboxes`);

    // Create groups with different member counts
    await createLargeGroup(workers, 50, client, conversation, message);
    await createLargeGroup(workers, 100, client, conversation, message);
    await createLargeGroup(workers, 200, client, conversation, message);

    await conversation.send("✅ Additional groups creation completed");

    console.log("Starting message sending process...");
    let messagesSent = 0;
    const totalMessages = config.workerCount * config.messageCount * 2;

    for (const worker of workers.getWorkers()) {
      await conversation.send(`🤖 Worker ${worker.name} starting...`);
      console.log(`Worker ${worker.name} starting message sends...`);

      const dm = await worker.client?.conversations.newDm(
        message.senderInboxId,
      );

      // Send DM messages
      for (let i = 0; i < config.messageCount; i++) {
        await dm?.send(
          `DM Test ${worker.name} - ${i + 1}/${config.messageCount}`,
        );
        messagesSent++;
      }

      // Use the new function for group messages
      await sendWorkerMessagesToGroup(workers, group.id, config.messageCount);

      console.log(`Worker ${worker.name} completed all messages`);
      await conversation.send(
        `✅ Worker ${worker.name} completed all messages`,
      );
    }

    console.log(
      `Test completed. Total messages sent: ${messagesSent}/${totalMessages}`,
    );

    await conversation.send(
      `🎉 Test completed successfully!\n\n` +
        `📊 Final Statistics:\n` +
        `- Total messages sent: ${messagesSent}\n` +
        `- Workers used: ${config.workerCount}\n` +
        `- Messages per worker: ${config.messageCount * 2}\n` +
        `- Test duration: ${Math.floor((Date.now() - startTime) / 1000)}s`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await conversation.send(
      `❌ Error during stress test:\n${errorMessage}\n\nUse /stress reset to try again.`,
    );
    console.error("Stress test error:", errorMessage);
  } finally {
    isStressTestRunning = false;
  }
}

async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
) {
  // Only show help text for DMs and non-commands
  const isDM = conversation instanceof Dm;
  if (!isDM) return;
  const content = message.content as string;
  console.log(`Processing message: "${content}" from ${message.senderInboxId}`);

  const args = content.split(" ");
  const command = args[0].toLowerCase();

  if (!command.startsWith("/") && isDM) {
    console.log("Sending help text for non-command message in DM");
    await conversation.send(message.senderInboxId);
    await conversation.send(HELP_TEXT);
    return;
  }

  // Handle commands
  console.log(`Handling command: ${command}`);
  switch (command) {
    case "/help":
      if (isDM) {
        console.log("Sending help text");
        await conversation.send(HELP_TEXT);
      }
      break;

    case "/stress": {
      if (args[1]?.toLowerCase() === "reset") {
        console.log("Processing stress reset command");
        // Terminate all workers
        try {
          if (workers) {
            await conversation.send("🧹 Cleaning up - terminating workers...");
            await workers.terminateAll();
            await conversation.send("✨ All workers terminated successfully");
          }
        } catch (cleanupError) {
          console.error("Error terminating workers:", cleanupError);
          await conversation.send(
            "⚠️ Warning: Some workers may not have terminated properly",
          );
        }
        isStressTestRunning = false;
        await conversation.send("🔄 Reset complete. Type /help to start over.");
        return;
      }

      if (isStressTestRunning) {
        console.log("Stress test already in progress, rejecting new test");
        await conversation.send(
          "⚠️ A stress test is already running. Please either:\n" +
            "1. Wait for it to complete, or\n" +
            "2. Use `/stress reset` to force stop all tests",
        );
        return;
      }

      const config = parseStressCommand(args);
      if (config) {
        console.log(`Starting stress test with config:`, config);
        await runStressTest(config, message, conversation, client);
      } else {
        if (isDM) {
          console.log("Invalid stress test command format");
          await conversation.send(
            "⚠️ Invalid command format. Type /help for usage instructions.",
          );
        }
      }
      break;
    }

    default:
      if (isDM) {
        console.log("Unknown command, sending help text");
        await conversation.send(HELP_TEXT);
      }
  }
}

async function main() {
  try {
    const client = await initializeBot();
    await client.conversations.sync();
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      try {
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
        console.error("Message handling error:", error);
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

void main();
