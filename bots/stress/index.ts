import { loadEnv } from "@helpers/client";
import {
  createGroupsWithWorkers,
  createLargeGroups,
  sendDmsFromWorkers,
  TEST_CONFIGS,
  type StressTestConfig,
} from "@helpers/stress";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

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
  await conversation.send("🚀 Running stress test...");

  // try {
  //   // Send DMs from workers to sender (if message provided)
  //   if (message && conversation) {
  //     await sendDmsFromWorkers(workers, message.senderInboxId, conversation);
  //   }
  // } catch (error) {
  //   console.error("Error during stress test:", error);
  //   if (conversation) {
  //     await conversation.send(`❌ Stress test failed while sending DMs`);
  //   }
  //   return false;
  // }
  console.log(message.senderInboxId);
  try {
    // Create groups with workers and send messages to them
    await createGroupsWithWorkers(workers, client, config, message);
    if (conversation) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      await conversation.send(
        `✅ Stress test completed in ${duration} seconds!`,
      );
    }
  } catch (error) {
    console.error("Error during stress test:", error);
    if (conversation) {
      await conversation.send(`❌ Stress test failed while creating groups`);
    }
    return false;
  }

  // try {
  //   // Create large groups
  //   await createLargeGroups(config, workers, receiverInboxId, conversation);
  // } catch (error) {
  //   console.error("Error during stress test:", error);
  //   if (conversation) {
  //     await conversation.send(
  //       `❌ Stress test failed while creating large groups`,
  //     );
  //   }
  //   return false;
  // }
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  if (conversation) {
    await conversation.send(`✅ Stress test completed in ${duration} seconds!`);
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
    const workers = await getWorkers(
      TEST_CONFIGS.small.workerCount,
      "stress",
      "message",
      "gm",
    );
    await runStressTest(config, workers, client, message, conversation);
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
