import { initializeClient } from "@bots/xmtp-handler";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  TEST_CONFIGS,
  type StressTestConfig,
} from "@helpers/groups";
import {
  getRandomNames,
  logAndSend,
  validateEnvironment,
} from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

const HELP_TEXT = `Stress bot commands:
/stress - Run the stress test (20 workers, 5 groups, 50-member large groups, 5 messages each)`;

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
): Promise<void> => {
  const content = message.content as string;
  const command = content.split(" ")[0].toLowerCase();

  // Only respond to /stress commands
  if (command !== "/stress") {
    await logAndSend(HELP_TEXT, conversation);
    return;
  }

  try {
    const config = TEST_CONFIGS.small;
    const workers = await getWorkers(
      getRandomNames(config.workerCount),
      "stressbot",
      typeofStream.None,
      typeOfResponse.None,
      client.options?.env ?? "dev",
    );

    await runStressTest(config, workers, client, message, conversation);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
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
  let hasErrors = false;
  await logAndSend(
    `Starting your test, the following will happen:
    - ${config.workerCount} workers will be created
    - ${config.messageCount} DMs will be sent from each worker to you
    - ${config.groupCount} groups with all workers will be created
    - ${config.messageCount} messages will be sent to each group
    - ${config.largeGroups.join(", ")} large groups will be created
    - ${config.messageCount} messages will be sent to each large group
    `,
    conversation,
  );

  // Send DMs from workers to sender
  await logAndSend(
    `Sending ${config.messageCount} DMs from each of ${config.workerCount} workers to you...`,
    conversation,
  );
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
    networks: ["dev", "production"],
    dbEncryptionKey: ENCRYPTION_KEY,
  },
]);
