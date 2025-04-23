import { loadEnv } from "@helpers/client";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  type StressTestConfig,
} from "@helpers/groups";
import { logAndSend, logAndSendError, logAndSendStatus } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

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
    groupCount: 3,
    sizeLabel: "medium",
  },
  large: {
    largeGroups: [50, 100, 200],
    workerCount: 100,
    messageCount: 15,
    groupCount: 5,
    sizeLabel: "large",
  },
};

const testName = "stressbot";
loadEnv(testName);

let isStressTestRunning = false;

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
  await logAndSendStatus("Running stress test...", conversation, "🚀");
  let hasErrors = false;

  try {
    // Send DMs from workers to sender
    await logAndSendStatus(
      "Sending DMs from workers to you...",
      conversation,
      "📩",
    );
    try {
      // Use the fixed receiver inbox ID instead of sender's
      await createAndSendDms(
        workers,
        message.senderInboxId,
        config.messageCount,
      );
    } catch (error) {
      await logAndSendError(error, conversation, "Some DMs failed to send");
      hasErrors = true;
      // Continue with the test despite errors
    }

    // Create groups with workers
    await logAndSendStatus(
      `Creating ${config.groupCount} regular groups...`,
      conversation,
      "🔄",
    );
    try {
      await createAndSendInGroup(
        workers,
        client,
        config.groupCount,
        message.senderInboxId,
      );
    } catch (error) {
      await logAndSendError(
        error,
        conversation,
        "Some groups failed to be created",
      );
      hasErrors = true;
    }

    // Create large groups
    await logAndSendStatus(
      `Creating large groups with ${config.largeGroups.join(", ")} members...`,
      conversation,
      "📊",
    );
    try {
      await createLargeGroups(
        config,
        workers,
        client,
        message.senderInboxId,
        conversation,
      );
    } catch (error) {
      await logAndSendError(
        error,
        conversation,
        "Large group creation had issues",
      );
      hasErrors = true;
    }
  } catch (error) {
    await logAndSendError(error, conversation, "Stress test failed");
    return false;
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  if (hasErrors) {
    await logAndSend(
      `⚠️ Stress test completed with some errors in ${duration} seconds.`,
      conversation,
      "warn",
    );
  } else {
    await logAndSend(
      `✅ Stress test completed successfully in ${duration} seconds!`,
      conversation,
    );
  }

  return true;
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
    await logAndSend(HELP_TEXT, conversation);
    return false;
  }

  if (isStressTestRunning) {
    await logAndSend(
      "⚠️ A stress test is already running. Please either:\n" +
        "1. Wait for it to complete, or\n" +
        "2. Use `/stress reset` to force stop all tests",
      conversation,
      "warn",
    );
    return false;
  }

  if (args.length < 2) {
    await logAndSend(HELP_TEXT, conversation);
    return false;
  }

  const sizeArg = args[1].toLowerCase();
  if (!["small", "medium", "large"].includes(sizeArg)) {
    await logAndSend(
      "⚠️ Invalid size option. Use 'small', 'medium', or 'large'.\n" +
        HELP_TEXT,
      conversation,
      "warn",
    );
    return false;
  }

  const config = TEST_CONFIGS[sizeArg];
  console.log(config);
  if (config) {
    // Create a smaller number of workers to prevent overwhelming the system
    // We'll limit to 5 workers max regardless of the config
    const limitedWorkerCount = Math.min(5, config.workerCount);
    await logAndSendStatus(
      `Creating ${limitedWorkerCount} workers instead of ${config.workerCount} to prevent system overload...`,
      conversation,
    );

    let workers = await getWorkers(limitedWorkerCount, testName, "none");

    // Update the config to reflect our adjusted worker count
    const adjustedConfig = {
      ...config,
      workerCount: limitedWorkerCount,
    };

    await runStressTest(adjustedConfig, workers, client, message, conversation);
  } else {
    await logAndSend(
      "⚠️ Invalid command format. Use /stress <size>\n" +
        "Size options: small, medium, or large",
      conversation,
      "warn",
    );
    return false;
  }
  return true;
}

async function initializeBot() {
  try {
    const botWorker = await getWorkers(["bot"], testName, "message", "none");
    const bot = botWorker.get("bot");

    if (!bot) {
      console.error("Bot worker not found");
      process.exit(1);
    }

    console.log("Bot worker:", bot.address);
    console.log("Bot worker client:", bot.client.inboxId);
    console.log(
      `https://xmtp.chat/dm/${bot.address}?env=${process.env.XMTP_ENV}`,
    );

    return bot.client;
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
