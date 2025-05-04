import { initializeClient } from "@bots/xmtp-handler";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  TEST_CONFIGS,
  type StressTestConfig,
} from "@helpers/groups";
import { logAndSend, validateEnvironment } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

const HELP_TEXT = `Stress bot commands:
/stress small - Run a small test: 20 workers, 5 groups, 50-member large groups, 5 messages each
/stress medium - Run a medium test: 50 workers, 3 groups, up to 100-member large groups, 10 messages each
/stress large - Run a large test: 100 workers, 5 groups, up to 200-member large groups, 15 messages each`;

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

/**
 * Process incoming messages and handle stress test commands
 */
const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
): Promise<void> => {
  console.log(
    `Message from ${message.senderInboxId} in ${isDm ? "DM" : "Group"} ${conversation.id}: ${message.content as string}`,
  );

  const content = message.content as string;
  const args = content.split(" ");
  const command = args[0].toLowerCase();

  // Only respond to /stress commands
  if (command !== "/stress") {
    await logAndSend(HELP_TEXT, conversation);
    return;
  }

  if (args.length < 2) {
    await logAndSend(HELP_TEXT, conversation);
    return;
  }

  const sizeArg = args[1].toLowerCase();
  if (!["small", "medium", "large"].includes(sizeArg)) {
    await logAndSend(
      `⚠️ Invalid size option. Use 'small', 'medium', or 'large'.\n${HELP_TEXT}`,
      conversation,
      "warn",
    );
    return;
  }

  try {
    const config = TEST_CONFIGS[sizeArg];
    console.log(`Creating ${config.workerCount} workers for stress test...`);

    const workers = await getWorkers(config.workerCount, "stressbot");
    console.log(`Successfully created ${workers.getWorkers().length} workers`);

    await runStressTest(config, workers, client, message, conversation);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error during stress test setup: ${errorMsg}`, error);
    await logAndSend(
      `⚠️ Error setting up stress test: ${errorMsg}`,
      conversation,
      "warn",
    );
  }
};

/**
 * Run a complete stress test based on configuration
 */
async function runStressTest(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  message: DecodedMessage,
  conversation: Conversation,
): Promise<boolean> {
  const startTime = Date.now();
  await logAndSend("Running stress test...", conversation);
  let hasErrors = false;

  try {
    // Send DMs from workers to sender
    await logAndSend("Sending DMs from workers to you...", conversation);
    try {
      await createAndSendDms(
        workers,
        message.senderInboxId,
        config.messageCount,
        conversation,
      );
    } catch (error) {
      console.error(error);
      await logAndSend("Some DMs failed to send", conversation);
      hasErrors = true;
      // Continue with the test despite errors
    }

    // Create groups with workers
    await logAndSend(
      `Creating ${config.groupCount} regular groups...`,
      conversation,
    );
    try {
      await createAndSendInGroup(
        workers,
        client,
        config.groupCount,
        message.senderInboxId,
        conversation,
      );
    } catch (error) {
      console.error(error);
      await logAndSend("Some groups failed to be created", conversation);
      hasErrors = true;
    }

    // Create large groups
    await logAndSend(
      `Creating large groups with ${config.largeGroups.join(", ")} members...`,
      conversation,
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
      console.error(error);
      await logAndSend("Large group creation had issues", conversation);
      hasErrors = true;
    }
  } catch (error) {
    console.error(error);
    await logAndSend("Stress test failed", conversation);
    return false;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  await logAndSend(
    hasErrors
      ? `⚠️ Stress test completed with some errors in ${duration} seconds.`
      : `✅ Stress test completed successfully in ${duration} seconds!`,
    conversation,
    hasErrors ? "warn" : undefined,
  );

  return !hasErrors;
}

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    acceptGroups: true,
    walletKey: WALLET_KEY,
    encryptionKey: ENCRYPTION_KEY,
  },
]);
