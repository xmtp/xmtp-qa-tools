import {
  IdentifierKind,
  type DecodedMessage,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "@helpers/versions";
import { sendTextCompat } from "@helpers/sdk-compat";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getWorkers } from "@workers/manager";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Examples:
// yarn blast --target 0xf1be9a945de5e4e270321cf47672f82380fd3463 --env dev --users 100
// yarn blast --target 0x7723d790a5e00b650bf146a0961f8bb148f0450c --env local --users 500 --wait
// yarn blast --target 0xadc58094c42e2a8149d90f626a1d6cfb4a79f002 --env local --users 500 --attempts 10
// yarn blast --group-id fa5d8fc796bb25283dccbc1823823f75 --env production --message "Hello group!"

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  target: string;
  groupId?: string;
  message?: string;
  customMessage?: string;
  senderAddress?: string;
  threshold: number;
  loggingLevel: LogLevel;
  awaitResponse: boolean;
  attempts: number;
}

function parseArgs(): Config {
  const argv = yargs(hideBin(process.argv))
    .scriptName("yarn blast")
    .usage("$0 [options]")
    .command("$0", "XMTP Send CLI - Message sending and testing", (yargs) => {
      return yargs;
    })
    .option("target", {
      alias: "t",
      type: "string",
      description: "Target wallet address to send messages to",
      default: process.env.TARGET ?? "",
    })
    .option("group-id", {
      alias: "g",
      type: "string",
      description: "Target group ID to send message to",
    })
    .option("message", {
      alias: "m",
      type: "string",
      description: "Custom message to send (required for group messages)",
    })
    .option("custom-message", {
      type: "string",
      description:
        "Custom message for individual DM messages (default: auto-generated)",
    })
    .option("sender", {
      alias: "s",
      type: "string",
      description: "Wallet address to use as sender (must be group member)",
    })
    .option("env", {
      alias: "e",
      type: "string",
      choices: ["local", "dev", "production"],
      description: "XMTP environment",
      default: process.env.XMTP_ENV ?? "production",
    })
    .option("users", {
      alias: "u",
      type: "number",
      description: "Number of users to simulate",
      default: 5,
    })
    .option("attempts", {
      alias: "a",
      type: "number",
      description: "Number of attempts to send messages",
      default: 1,
    })
    .option("threshold", {
      type: "number",
      description: "Success threshold percentage",
      default: 95,
    })
    .option("wait", {
      type: "boolean",
      description: "Wait for responses from target",
      default: false,
    })
    .check((argv) => {
      // Validation - yargs converts kebab-case option names to camelCase
      const groupId = (argv as any).groupId;
      const target = argv.target;

      if (groupId && !argv.message) {
        throw new Error("--message is required when using --group-id");
      }

      if (groupId && target) {
        throw new Error("Cannot use both --group-id and --target. Choose one.");
      }

      if (!groupId && !target) {
        throw new Error("Either --group-id or --target is required");
      }

      if (argv.attempts && argv.attempts < 1) {
        throw new Error("--attempts must be at least 1");
      }

      return true;
    })
    .help("help")
    .alias("help", "h")
    .example(
      "$0 --target 0x1234... --env dev --users 10",
      "Send messages to a target address with 10 users",
    )
    .example(
      "$0 --target 0x1234... --env production --users 500 --wait",
      "Send messages and wait for responses",
    )
    .example(
      "$0 --target 0x1234... --env production --users 10 --attempts 5",
      "Send messages with 5 attempts",
    )
    .example(
      "$0 --target 0x1234... --custom-message 'Hello from CLI!' --env dev",
      "Send a custom message",
    )
    .example(
      "$0 --group-id abc123... --message 'Hello group!' --sender 0x1234... --env production",
      "Send a message to a group",
    )
    .epilogue(
      `ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network
  production  Production XMTP network

ENVIRONMENT VARIABLES:
  TARGET               Default target address
  XMTP_ENV             Default environment
  LOGGING_LEVEL        Logging level

For more information, see: cli/readme.md`,
    )
    .strict()
    .parseSync();

  // yargs converts kebab-case option names to camelCase in the parsed object
  const config: Config = {
    userCount: argv.users ?? 5,
    timeout: 120 * 1000, // 120 seconds - used only when --wait is specified
    env: argv.env ?? process.env.XMTP_ENV ?? "production",
    target: argv.target ?? process.env.TARGET ?? "",
    groupId: (argv as any).groupId,
    message: argv.message,
    customMessage: argv["custom-message"],
    senderAddress: argv.sender,
    threshold: argv.threshold ?? 95,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    awaitResponse: argv.wait ?? false,
    attempts: argv.attempts ?? 1,
  };

  return config;
}

function cleanupsendDatabases(env: string): void {
  const dataDir = path.resolve(".data/send");

  if (!fs.existsSync(dataDir)) {
    console.log(`🧹 No data directory found at ${dataDir}, skipping cleanup`);
    return;
  }

  try {
    const files = fs.readdirSync(dataDir);
    const sendFiles = files.filter((file) => file.startsWith(`send-`));

    if (sendFiles.length === 0) {
      console.log(`🧹 No send test database files found for env: ${env}`);
      return;
    }

    console.log(
      `🧹 Cleaning up ${sendFiles.length} send test database files...`,
    );

    for (const file of sendFiles) {
      const filePath = path.join(dataDir, file);
      fs.unlinkSync(filePath);
    }

    console.log(`🗑️  Removed: ${sendFiles.length} send test database files`);
  } catch (error) {
    console.error(`❌ Error during cleanup:`, error);
  }
}

async function sendGroupMessage(config: Config): Promise<void> {
  if (!config.groupId || !config.message) {
    console.error(
      "❌ Error: Group ID and message are required for group messaging",
    );
    return;
  }

  console.log(`📤 Sending message to group ${config.groupId} on ${config.env}`);

  // Create a single worker for group messaging
  const workerManager = await getWorkers(1, {
    env: config.env as XmtpEnv,
  });

  const worker = workerManager.getAll()[0];
  console.log(`📋 Using worker: ${worker.inboxId}`);

  try {
    // Sync conversations to get all available groups
    console.log(`🔄 Syncing conversations...`);
    await worker.client.conversations.sync();

    // Get all conversations and find the group by ID
    const conversations = await worker.client.conversations.list();
    console.log(`📋 Found ${conversations.length} conversations`);

    const group = conversations.find(
      (conv) => conv.id === config.groupId,
    ) as Group;
    if (!group) {
      console.error(`❌ Group with ID ${config.groupId} not found`);
      console.log(`📋 Available conversation IDs:`);
      conversations.forEach((conv) => {
        console.log(`   - ${conv.id}`);
      });
      return;
    }

    console.log(`📋 Found group: ${group.id}`);

    // Send the message
    const sendStart = Date.now();
    await sendTextCompat(group, config.message);
    const sendTime = Date.now() - sendStart;

    console.log(`✅ Message sent successfully in ${sendTime}ms`);
    console.log(`💬 Message: "${config.message}"`);
    console.log(
      `🔗 Group URL: https://xmtp.chat/conversations/${config.groupId}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to send group message: ${errorMessage}`);
  }

  process.exit(0);
}

interface TestResult {
  success: boolean;
  sendTime: number;
  responseTime: number;
  attempt: number;
  workerId: number;
}

// Simple worker task that sends a message and optionally waits for response
async function runWorker(
  worker: any,
  workerId: number,
  attempt: number,
  config: Config,
): Promise<TestResult> {
  try {
    // Create conversation
    const conversation = await worker.client.conversations.newDmWithIdentifier({
      identifier: config.target,
      identifierKind: IdentifierKind.Ethereum,
    });

    let responseTime = 0;
    let responsePromise: Promise<void> | null = null;

    // Set up response listener if awaiting
    if (config.awaitResponse) {
      responsePromise = new Promise<void>((resolve) => {
        const responseStart = Date.now();

        void worker.client.conversations.streamAllMessages({
          onValue: (message: DecodedMessage) => {
            if (
              message.senderInboxId.toLowerCase() !==
              worker.inboxId.toLowerCase()
            ) {
              responseTime = Date.now() - responseStart;
              resolve();
            }
          },
        });
      });

      // Small delay to ensure stream is set up
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Send message
    const sendStart = Date.now();
    const messageText =
      config.customMessage || `test-${workerId}-${attempt}-${Date.now()}`;
    await conversation.send(messageText);
    const sendTime = Date.now() - sendStart;

    console.log(
      `📩 ${workerId}: Attempt ${attempt}, Message sent in ${sendTime}ms`,
    );

    // Wait for response if required
    if (config.awaitResponse && responsePromise) {
      await Promise.race([
        responsePromise,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Response timeout"));
          }, config.timeout);
        }),
      ]);
      console.log(
        `✅ ${workerId}: Attempt ${attempt}, Send=${sendTime}ms, Response=${responseTime}ms`,
      );
    } else {
      console.log(
        `✅ ${workerId}: Attempt ${attempt}, Send=${sendTime}ms (no await)`,
      );
    }

    return {
      success: true,
      sendTime,
      responseTime,
      attempt,
      workerId,
    };
  } catch (error) {
    console.log(
      `❌ ${workerId}: Attempt ${attempt} failed - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      success: false,
      sendTime: 0,
      responseTime: 0,
      attempt,
      workerId,
    };
  }
}

// Run a single attempt with all workers
async function runAttempt(
  attempt: number,
  config: Config,
): Promise<TestResult[]> {
  console.log(`\n🔄 Starting attempt ${attempt}/${config.attempts}...`);

  // Create fresh workers
  const prefixedNames = Array.from(
    { length: config.userCount },
    (_, i) => `randomtest${i}${attempt}`,
  );
  const workerManager = await getWorkers(prefixedNames, {
    env: config.env as XmtpEnv,
  });
  const workers = workerManager.getAll();

  console.log(
    `📋 Initialized ${workers.length} workers for attempt ${attempt}`,
  );

  try {
    // Run all workers in parallel
    const promises = workers.map((worker, i) =>
      runWorker(worker, i, attempt, config),
    );
    const results = await Promise.allSettled(promises);

    // Extract results (fulfilled or failed)
    const attemptResults = results.map((result, i) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        console.log(`❌ ${i}: Attempt ${attempt} promise rejected`);
        return {
          success: false,
          sendTime: 0,
          responseTime: 0,
          attempt,
          workerId: i,
        };
      }
    });

    const successful = attemptResults.filter((r) => r.success);
    const successRate = (successful.length / config.userCount) * 100;

    console.log(
      `📊 Attempt ${attempt}: ${successful.length}/${config.userCount} successful (${successRate.toFixed(1)}%)`,
    );

    return attemptResults;
  } finally {
    // Always cleanup workers
    try {
      await workerManager.terminateAll(true);
      console.log(`🧹 Cleaned up workers for attempt ${attempt}`);
    } catch (error) {
      console.error(`❌ Cleanup error for attempt ${attempt}:`, error);
    }
  }
}

// Print final summary
function printSummary(
  allResults: TestResult[],
  config: Config,
  duration: number,
) {
  const successful = allResults.filter((r) => r.success);
  const total = config.userCount * config.attempts;
  const successRate = (successful.length / total) * 100;

  console.log(`\n📊 Summary:`);
  console.log(`   Attempts: ${config.attempts}`);
  console.log(`   Workers per attempt: ${config.userCount}`);
  console.log(`   Total operations: ${total}`);
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${total - successful.length}`);
  console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

  if (successful.length > 0) {
    const sendTimes = successful.map((r) => r.sendTime);
    const avgSend =
      sendTimes.reduce((sum, time) => sum + time, 0) / successful.length;
    console.log(`   Avg Send Time: ${(avgSend / 1000).toFixed(2)}s`);

    if (config.awaitResponse) {
      const responseTimes = successful
        .map((r) => r.responseTime)
        .filter((t) => t > 0);
      if (responseTimes.length > 0) {
        const avgResponse =
          responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length;
        console.log(
          `   Avg Response Time: ${(avgResponse / 1000).toFixed(2)}s`,
        );

        // Percentiles
        const sorted = responseTimes.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        console.log(`   Response Median: ${(median / 1000).toFixed(2)}s`);
        console.log(`   Response P95: ${(p95 / 1000).toFixed(2)}s`);
      }
    }
  }

  // Check threshold
  if (successRate >= config.threshold) {
    console.log(`🎯 Success threshold (${config.threshold}%) reached!`);
  } else {
    console.log(`⚠️  Success rate below threshold (${config.threshold}%)`);
  }
}

async function runsendTest(config: Config): Promise<void> {
  const startTime = Date.now();
  console.log(
    `🚀 Testing ${config.userCount} users on ${config.env} with ${config.attempts} attempt(s)`,
  );

  if (config.awaitResponse) {
    console.log(`⏳ Will await responses with ${config.timeout}ms timeout`);
  } else {
    console.log(`📤 Send-only mode (no response waiting)`);
  }

  cleanupsendDatabases(config.env);

  const allResults: TestResult[] = [];

  // Run each attempt independently
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    const attemptResults = await runAttempt(attempt, config);
    allResults.push(...attemptResults);

    // Small delay between attempts
    if (attempt < config.attempts) {
      console.log(`⏳ Waiting 2 seconds before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const duration = Date.now() - startTime;
  printSummary(allResults, config, duration);

  process.exit(0);
}

async function main(): Promise<void> {
  const config = parseArgs();

  if (config.groupId) {
    await sendGroupMessage(config);
  } else {
    await runsendTest(config);
  }
}

void main();
