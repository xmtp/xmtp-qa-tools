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

export const HELP_TEXT = `Stress bot commands:

/stress small - Run a small test: Creates a group with 20 members, 3 workers, 5 messages each
/stress medium - Run a medium test: Creates a group with 50 members, 5 workers, 10 messages each
/stress large - Run a large test: Creates a group with 100 members, 10 workers, 15 messages each`;

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
    let workers = await getWorkers(config.workerCount, testName, "none");

    await runStressTest(config, workers, client, message, conversation);
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

        await handleStressCommand(message, conversation, client);
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
