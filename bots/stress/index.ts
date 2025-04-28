import { loadEnv } from "@helpers/client";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  type StressTestConfig,
} from "@helpers/groups";
import { logAndSend } from "@helpers/tests";
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

export const HELP_TEXT = `Stress bot commands:

/stress small - Run a small test: Creates a group with 20 members, large groups with 50 members, 20 workers, 5 messages each
/stress medium - Run a medium test: Creates a group with 50 members, large groups up to 100 members, 50 workers, 10 messages each
/stress large - Run a large test: Creates a group with 100 members, large groups up to 200 members, 100 workers, 15 messages each`;

// Singleton lock to prevent multiple stress tests from running concurrently
class StressTestLock {
  private static instance: StressTestLock;
  private isRunning: boolean = false;
  private runningUser: string = "";
  private startTime: number = 0;

  private constructor() {}

  public static getInstance(): StressTestLock {
    if (!StressTestLock.instance) {
      StressTestLock.instance = new StressTestLock();
    }
    return StressTestLock.instance;
  }

  public acquire(userInboxId: string): boolean {
    if (this.isRunning) {
      return false;
    }
    this.isRunning = true;
    this.runningUser = userInboxId;
    this.startTime = Date.now();
    return true;
  }

  public release(): void {
    this.isRunning = false;
    this.runningUser = "";
  }

  public getRunningUser(): string {
    return this.runningUser;
  }

  public getRunningTime(): number {
    if (!this.isRunning) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public isTestRunning(): boolean {
    return this.isRunning;
  }
}

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
  await logAndSend("Running stress test...", conversation);
  let hasErrors = false;

  try {
    // Send DMs from workers to sender
    await logAndSend("Sending DMs from workers to you...", conversation);
    try {
      // Use the fixed receiver inbox ID instead of sender's
      await createAndSendDms(
        workers,
        message.senderInboxId,
        config.messageCount,
      );
    } catch (error) {
      console.debug(error);
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
      );
    } catch (error) {
      console.debug(error);
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
      console.debug(error);
      await logAndSend("Large group creation had issues", conversation);
      hasErrors = true;
    }
  } catch (error) {
    console.debug(error);
    await logAndSend("Stress test failed", conversation);
    // Release the lock when test fails
    StressTestLock.getInstance().release();
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

  // Release the lock when test completes
  StressTestLock.getInstance().release();
}

/**
 * Handle message commands for the stress bot
 */
export async function handleStressCommand(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
): Promise<boolean> {
  const content = message.content as string;
  const args = content.split(" ");
  const command = args[0].toLowerCase();

  // Only handle /stress commands
  if (command !== "/stress") {
    await logAndSend(HELP_TEXT, conversation);
    return false;
  }

  if (args.length < 2) {
    await logAndSend(HELP_TEXT, conversation);
    return false;
  }

  // Check if a status check is requested
  if (args[1].toLowerCase() === "status") {
    const lock = StressTestLock.getInstance();
    if (lock.isTestRunning()) {
      const runningTime = lock.getRunningTime();
      await logAndSend(
        `🔒 A stress test is currently running for ${runningTime} seconds, started by user with inboxId: ${lock.getRunningUser().substring(0, 10)}...`,
        conversation,
      );
    } else {
      await logAndSend("✅ No stress test is currently running.", conversation);
    }
    return true;
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

  // Check if a test is already running
  const lock = StressTestLock.getInstance();
  if (lock.isTestRunning()) {
    const runningUser = lock.getRunningUser();
    const runningTime = lock.getRunningTime();

    await logAndSend(
      `⚠️ A stress test is already running for ${runningTime} seconds. Started by user with inboxId: ${runningUser.substring(0, 10)}...\nPlease try again later or check status with '/stress status'.`,
      conversation,
      "warn",
    );
    return false;
  }

  // Acquire the lock
  if (!lock.acquire(message.senderInboxId)) {
    await logAndSend(
      "⚠️ Could not start stress test. Another test might have just started.",
      conversation,
      "warn",
    );
    return false;
  }

  const config = TEST_CONFIGS[sizeArg];

  if (config) {
    try {
      console.log(`Creating ${config.workerCount} workers for stress test...`);
      // Generate random prefix to avoid conflicts with other tests
      const randomPrefix = Math.random().toString(36).substring(2, 6);
      // Create workers with numeric names to avoid conflicts
      const workerNames = Array.from(
        { length: config.workerCount },
        (_, i) => `stress${randomPrefix}_${i}`,
      );

      let workers = await getWorkers(workerNames, testName, "none");
      console.log(
        `Successfully created ${workers.getWorkers().length} workers`,
      );

      await runStressTest(config, workers, client, message, conversation);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error during stress test setup: ${errorMsg}`, error);
      await logAndSend(
        `⚠️ Error setting up stress test: ${errorMsg}`,
        conversation,
        "warn",
      );
      // Release the lock when test fails
      StressTestLock.getInstance().release();
    }
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
  const client = await initializeBot();
  await startGPTWorkers();

  await client.conversations.sync();
  while (true) {
    try {
      const streamPromise = client.conversations.streamAllMessages();
      const stream = await streamPromise;

      for await (const message of stream) {
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

          await handleStressCommand(message, conversation, client);
        } catch (error) {
          console.error(
            "Error handling message:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch (error) {
      console.error(
        "Stream error:",
        error instanceof Error ? error.message : String(error),
      );
      console.error("Fatal error, restarting stream in 5 seconds...");
      // Wait 5 seconds before restarting the stream
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // Don't exit on stream errors, just retry
    }
  }
}

const startGPTWorkers = async () => {
  try {
    // First check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set in environment variables. GPT workers may not function properly.",
      );
    }

    console.log("Attempting to initialize GPT workers...");
    const workersGpt = await getWorkers(
      ["sam", "tina", "walt"],
      testName,
      "message",
      "gpt",
    );
    console.log("GPT workers:", workersGpt.getWorkers().length);
    for (const worker of workersGpt.getWorkers()) {
      console.log("GPT workers:", worker.name, worker.address);
    }
    console.log(
      workersGpt
        .getWorkers()
        .map((w) => w.address)
        .join(", "),
    );
    return workersGpt;
  } catch (error) {
    console.error(
      "Failed to initialize GPT workers:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Error details:", error);
    // Don't crash the whole application if GPT workers fail
    console.log("Continuing without GPT workers");
    return null;
  }
};

main().catch(console.error);
