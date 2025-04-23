import { loadEnv } from "@helpers/client";
import {
  createGroupsWithWorkers,
  createLargeGroups,
  sendDmsFromWorkers,
  TEST_CONFIGS,
  type StressTestConfig,
} from "@helpers/groups";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

const testName = "stressbot";
loadEnv(testName);

let isStressTestRunning = false;

// Use a known existing inbox ID for consistency - this matches the test suite
const RECEIVER_INBOX_ID =
  "ac9feb1384a9092333db4d17c6981743a53277c24c57ed6f12f05bd78a81be30";

export const HELP_TEXT = `Stress bot commands:

/stress small - Run a small test: Creates a group with 20 members, 3 workers, 5 messages each
/stress medium - Run a medium test: Creates a group with 50 members, 5 workers, 10 messages each
/stress large - Run a large test: Creates a group with 100 members, 10 workers, 15 messages each`;

/**
 * Run a complete stress test based on configuration
 */
export async function runStressTest(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  message: DecodedMessage,
  conversation: Conversation,
) {
  const startTime = Date.now();
  await conversation.send("🚀 Running stress test...");
  let hasErrors = false;

  try {
    // Send DMs from workers to sender
    await conversation.send("📩 Sending DMs from workers to you...");
    try {
      // Use the fixed receiver inbox ID instead of sender's
      await sendDmsFromWorkers(workers, RECEIVER_INBOX_ID, conversation);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error during DM sending:", errorMessage);
      await conversation.send(`⚠️ Some DMs failed to send: ${errorMessage}`);
      hasErrors = true;
      // Continue with the test despite errors
    }

    // Create groups with workers
    await conversation.send(
      `🔄 Creating ${config.groupCount} regular groups...`,
    );
    try {
      // Pass the fixed receiver inbox ID instead of message.senderInboxId
      await createGroupsWithWorkers(workers, client, config, RECEIVER_INBOX_ID);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error during group creation:", errorMessage);
      await conversation.send(
        `⚠️ Some groups failed to be created: ${errorMessage}`,
      );
      hasErrors = true;
      // Continue with the test despite errors
    }

    // Create large groups
    await conversation.send(
      `📊 Creating large groups with ${config.largeGroups.join(", ")} members...`,
    );
    try {
      await createLargeGroups(config, workers, RECEIVER_INBOX_ID, conversation);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error during large group creation:", errorMessage);
      await conversation.send(
        `⚠️ Large group creation had issues: ${errorMessage}`,
      );
      hasErrors = true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fatal error during stress test:", errorMessage);
    await conversation.send(
      `❌ Stress test failed with error: ${errorMessage}`,
    );
    return false;
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  if (hasErrors) {
    await conversation.send(
      `⚠️ Stress test completed with some errors in ${duration} seconds.`,
    );
  } else {
    await conversation.send(
      `✅ Stress test completed successfully in ${duration} seconds!`,
    );
  }

  return !hasErrors;
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
  console.log(config);
  if (config) {
    // Create a smaller number of workers to prevent overwhelming the system
    // We'll limit to 5 workers max regardless of the config
    const limitedWorkerCount = Math.min(5, config.workerCount);
    await conversation.send(
      `Creating ${limitedWorkerCount} workers instead of ${config.workerCount} to prevent system overload...`,
    );

    let workers = await getWorkers(
      limitedWorkerCount,
      testName,
      "message",
      "gm",
    );

    // Update the config to reflect our adjusted worker count
    const adjustedConfig = {
      ...config,
      workerCount: limitedWorkerCount,
    };

    await runStressTest(adjustedConfig, workers, client, message, conversation);
  } else {
    await conversation.send(
      "⚠️ Invalid command format. Use /stress <size>\n" +
        "Size options: small, medium, or large",
    );
    return false;
  }
  return true;
}

async function initializeBot() {
  try {
    const botWorker = await getWorkers(["bot"], testName, "message", "none");
    const bot = botWorker.get("bot");
    console.log("Bot worker:", bot?.address);
    console.log("Bot worker client:", bot?.client.inboxId);
    console.log(
      `https://xmtp.chat/dm/${bot?.address}?env=${process.env.XMTP_ENV}`,
    );
    return bot?.client as Client;
  } catch (error) {
    console.debug(error);
    console.error("Error initializing bot:", error);
    process.exit(1);
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

        // Only handle DM conversations
        if (!("peerInboxId" in conversation)) continue;

        isStressTestRunning = await handleStressCommand(
          message,
          conversation,
          client,
          isStressTestRunning,
        );
      } catch (error) {
        console.debug(error);
        console.error("Error handling message:", error);
      }
    }
  } catch (error) {
    console.debug(error);
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
