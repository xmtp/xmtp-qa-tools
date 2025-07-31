import {
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getWorkers } from "@workers/manager";

// gm-bot
// yarn send --target 0x194c31cae1418d5256e8c58e0d08aee1046c6ed0 --env production --users 500 --wait
// local gm bot=
// yarn send --target 0xadc58094c42e2a8149d90f626a1d6cfb4a79f002 --env local   --users 500  --attempts 10
// echo
// yarn send --target 0x7723d790a5e00b650bf146a0961f8bb148f0450c --env local --users 500 --wait

// group message
// yarn send --group-id fa5d8fc796bb25283dccbc1823823f75 --env production --message "Hello group!"

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  target: string;
  groupId?: string;
  message?: string;
  customMessage?: string;
  senderAddress?: string;
  tresshold: number;
  loggingLevel: LogLevel;
  waitForResponse: boolean;
  attempts: number;
}

function showHelp() {
  console.log(`
XMTP Send CLI - Message sending and testing

USAGE:
  yarn send [options]

OPTIONS:
  --target <address>     Target wallet address to send messages to
  --group-id <id>         Target group ID to send message to
  --message <text>        Custom message to send (required for group messages)
  --custom-message <text> Custom message for individual DM messages (default: auto-generated)
  --sender <address>      Wallet address to use as sender (must be group member)
  --env <environment>     XMTP environment (local, dev, production) [default: production]
  --users <count>         Number of users to simulate [default: 5]
  --attempts <count>      Number of attempts to send messages [default: 1]
  --tresshold <percent>   Success threshold percentage [default: 95]
  --wait                  Wait for responses from target
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  yarn send --target 0x1234... --env dev --users 10
  yarn send --target 0x1234... --env production --users 500 --wait
  yarn send --target 0x1234... --env production --users 10 --attempts 5
  yarn send --target 0x1234... --custom-message "Hello from CLI!" --env dev
  yarn send --group-id abc123... --message "Hello group!" --sender 0x1234... --env production
  yarn send --help

ENVIRONMENT VARIABLES:
  TARGET               Default target address
  XMTP_ENV             Default environment
  LOGGING_LEVEL        Logging level

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    timeout: 120 * 1000, // 120 seconds - increased for XMTP operations
    env: process.env.XMTP_ENV ?? "production",
    target: process.env.TARGET ?? "",
    tresshold: 95,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    waitForResponse: false,
    attempts: 1, // Default to 1 attempt
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--target" && nextArg) {
      config.target = nextArg;
      i++;
    } else if (arg === "--group-id" && nextArg) {
      config.groupId = nextArg;
      i++;
    } else if (arg === "--message" && nextArg) {
      config.message = nextArg;
      i++;
    } else if (arg === "--custom-message" && nextArg) {
      config.customMessage = nextArg;
      i++;
    } else if (arg === "--sender" && nextArg) {
      config.senderAddress = nextArg;
      i++;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--attempts" && nextArg) {
      config.attempts = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--tresshold" && nextArg) {
      config.tresshold = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--wait") {
      config.waitForResponse = true;
    }
  }

  // Validation
  if (config.groupId && !config.message) {
    console.error("❌ Error: --message is required when using --group-id");
    process.exit(1);
  }

  if (config.groupId && config.target) {
    console.error(
      "❌ Error: Cannot use both --group-id and --target. Choose one.",
    );
    process.exit(1);
  }

  if (!config.groupId && !config.target) {
    console.error("❌ Error: Either --group-id or --target is required");
    process.exit(1);
  }

  if (config.attempts < 1) {
    console.error("❌ Error: --attempts must be at least 1");
    process.exit(1);
  }

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

// Helper function to calculate percentiles
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
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
    useVersions: false, // Use latest version for group messaging
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
    await group.send(config.message);
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

async function runsendTest(config: Config): Promise<void> {
  const startTime = Date.now();
  console.log(
    `🚀 Testing ${config.userCount} users on ${config.env} with ${config.attempts} attempt(s)`,
  );

  cleanupsendDatabases(config.env);

  const logSummary = (
    results: Array<{
      success: boolean;
      sendTime: number;
      responseTime: number;
      attempt: number;
    }>,
    completedWorkers: number,
    totalMessagesSent: number,
    startTime: number,
    firstMessageTime: number,
    lastMessageTime: number,
  ) => {
    const successful = results.filter((r) => r.success);
    const successRate =
      (successful.length / (config.userCount * config.attempts)) * 100;
    const failed = config.userCount * config.attempts - successful.length;
    const duration = Date.now() - startTime;

    console.log(`\n📊 Summary:`);
    console.log(`   Attempts: ${config.attempts}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Total: ${totalMessagesSent}`);

    if (successful.length > 0) {
      const sendTimes = successful.map((r) => r.sendTime);
      const totalSendTime = lastMessageTime - firstMessageTime;
      const avgSend =
        sendTimes.reduce((sum, time) => sum + time, 0) / successful.length;

      console.log(`   Total Send Time: ${(totalSendTime / 1000).toFixed(2)}s`);
      console.log(`   Avg Send: ${(avgSend / 1000).toFixed(2)}s`);

      // Guard against division by zero
      if (totalSendTime > 0) {
        const messagesPerSecond = (
          totalMessagesSent /
          (totalSendTime / 1000)
        ).toFixed(2);
        console.log(`   Messages/Second: ${messagesPerSecond}`);
      } else {
        console.log(`   Messages/Second: N/A (no time difference)`);
      }

      if (config.waitForResponse) {
        const responseTimes = successful.map((r) => r.responseTime);
        const avgResponse =
          responseTimes.reduce((sum, time) => sum + time, 0) /
          successful.length;
        console.log(`   Avg Response: ${(avgResponse / 1000).toFixed(2)}s`);

        // Calculate and log percentiles for response times
        const median = calculatePercentile(responseTimes, 50);
        const p80 = calculatePercentile(responseTimes, 80);
        const p95 = calculatePercentile(responseTimes, 95);
        const p99 = calculatePercentile(responseTimes, 99);

        console.log(`   Response Time Percentiles:`);
        console.log(`     Median: ${(median / 1000).toFixed(2)}s`);
        console.log(`     P80: ${(p80 / 1000).toFixed(2)}s`);
        console.log(`     P95: ${(p95 / 1000).toFixed(2)}s`);
        console.log(`     P99: ${(p99 / 1000).toFixed(2)}s`);
      }
    }
  };

  // Shared counters across all attempts
  let totalMessagesSent = 0;
  let completedWorkers = 0;
  let summaryPrinted = false;
  let firstMessageTime = 0;
  let lastMessageTime = 0;
  const allResults: Array<{
    success: boolean;
    sendTime: number;
    responseTime: number;
    attempt: number;
  }> = [];

  // Run attempts sequentially with fresh workers each time
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    console.log(`\n🔄 Starting attempt ${attempt}/${config.attempts}...`);

    // Create fresh workers for each attempt to ensure new installations
    console.log(
      `📋 Initializing ${config.userCount} fresh workers for attempt ${attempt}...`,
    );

    const prefixedNames = [];
    for (let i = 0; i < config.userCount; i++) {
      prefixedNames.push(`randomtest${i}${attempt}`);
    }

    const workerManager = await getWorkers(prefixedNames, {
      env: config.env as XmtpEnv,
    });

    const workers = workerManager.getAll();
    console.log(
      `✅ All ${config.userCount} fresh workers initialized for attempt ${attempt}`,
    );

    let attemptCompletedWorkers = 0;
    const attemptResults: Array<{
      success: boolean;
      sendTime: number;
      responseTime: number;
      attempt: number;
    }> = [];

    // Run all workers in parallel for this attempt
    console.log(`🔄 Starting parallel execution for attempt ${attempt}...`);

    const promises = workers.map((worker, i) => {
      return new Promise<{
        success: boolean;
        sendTime: number;
        responseTime: number;
        attempt: number;
      }>((resolve) => {
        let responseReceived = false;
        let sendCompleteTime = 0;
        let sendTime = 0;

        const process = async () => {
          try {
            let conversation: Conversation;

            conversation =
              (await worker.client.conversations.newDmWithIdentifier({
                identifier: config.target,
                identifierKind: IdentifierKind.Ethereum,
              })) as Conversation;

            if (config.waitForResponse) {
              console.log(
                `📡 ${i}: Setting up message stream for attempt ${attempt}...`,
              );
              // Set up stream
              void worker.client.conversations.streamAllMessages({
                onValue: (message: DecodedMessage) => {
                  // Check for bot response
                  if (
                    message.senderInboxId.toLowerCase() !==
                      worker.inboxId.toLowerCase() &&
                    !responseReceived
                  ) {
                    responseReceived = true;

                    // 3. Calculate response time
                    const responseTime = Date.now() - sendCompleteTime;

                    const result = {
                      success: true,
                      sendTime,
                      responseTime,
                      attempt,
                    };
                    attemptResults.push(result);
                    allResults.push(result);
                    attemptCompletedWorkers++;
                    completedWorkers++;

                    const successRate =
                      (attemptResults.filter((r) => r.success).length /
                        config.userCount) *
                      100;
                    console.log(
                      `✅ ${i}: Attempt ${attempt}, Send=${sendTime}ms, Response=${responseTime}ms (${completedWorkers}/${config.userCount * config.attempts}, ${successRate.toFixed(1)}% success)`,
                    );

                    // Check if we've reached the success threshold for this attempt
                    if (successRate >= config.tresshold) {
                      console.log(
                        `🎯 Success threshold (${config.tresshold}%) reached for attempt ${attempt}!`,
                      );
                    }

                    resolve(result);
                  }
                },
              });
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            console.log(
              `📤 ${i}: Sending test message for attempt ${attempt}...`,
            );
            // 2. Time message send
            const sendStart = Date.now();

            // Use custom message if provided, otherwise use auto-generated message
            const messageText =
              config.customMessage || `test-${i}-${attempt}-${Date.now()}`;
            await conversation.send(messageText);
            totalMessagesSent++;
            sendTime = Date.now() - sendStart;
            sendCompleteTime = Date.now();

            // Track first and last message times
            if (firstMessageTime === 0) {
              firstMessageTime = sendCompleteTime;
            }
            lastMessageTime = sendCompleteTime;

            console.log(
              `📩 ${i}: Attempt ${attempt}, Message sent in ${sendTime}ms (Total sent: ${totalMessagesSent})`,
            );

            // If not waiting for response, resolve immediately
            if (!config.waitForResponse) {
              const result = {
                success: true,
                sendTime,
                responseTime: 0, // No response time when not waiting
                attempt,
              };
              attemptResults.push(result);
              allResults.push(result);
              attemptCompletedWorkers++;
              completedWorkers++;

              const successRate =
                (attemptResults.filter((r) => r.success).length /
                  config.userCount) *
                100;
              console.log(
                `✅ ${i}: Attempt ${attempt}, Send=${sendTime}ms (${completedWorkers}/${config.userCount * config.attempts}, ${successRate.toFixed(1)}% success)`,
              );

              // Check if we've reached the success threshold for this attempt
              if (successRate >= config.tresshold) {
                console.log(
                  `🎯 Success threshold (${config.tresshold}%) reached for attempt ${attempt}!`,
                );
              }

              resolve(result);
            }
          } catch (error) {
            console.error(error);
          }
        };

        process().catch(() => {
          const result = {
            success: false,
            sendTime: 0,
            responseTime: 0,
            attempt,
          };
          attemptResults.push(result);
          allResults.push(result);
          attemptCompletedWorkers++;
          completedWorkers++;
          console.log(
            `❌ ${i}: Attempt ${attempt} failed (${completedWorkers}/${config.userCount * config.attempts})`,
          );
          resolve(result);
        });
      });
    });

    // First, wait for all messages to be sent for this attempt (no timeout for sending)
    console.log(
      `📤 Waiting for all messages to be sent for attempt ${attempt}...`,
    );

    // For non-wait mode, promises resolve immediately after sending
    // For wait mode, promises resolve after receiving responses
    const sendPromises = promises.map((promise) =>
      promise.then((result) => result),
    );

    // Wait for all messages to be sent first (no timeout)
    await Promise.all(sendPromises);
    console.log(`✅ All messages sent successfully for attempt ${attempt}`);

    // Now start the timeout for waiting for responses (only relevant for wait mode)
    if (config.waitForResponse) {
      console.log(
        `⏳ Waiting for responses for attempt ${attempt} (timeout: ${config.timeout}ms)...`,
      );

      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Attempt ${attempt} timed out after ${config.timeout}ms`,
              ),
            );
          }, config.timeout);
        });

        // Wait for all responses or timeout
        await Promise.race([
          Promise.all(sendPromises), // Wait for all responses
          timeoutPromise, // Or timeout
        ]);

        console.log(`✅ All responses received for attempt ${attempt}`);
      } catch (error) {
        console.error(
          `\n⏰ ${error instanceof Error ? error.message : `Attempt ${attempt} timed out`}`,
        );
        console.log(`📊 Partial Summary for attempt ${attempt}:`);
        console.log(
          `   Completed: ${attemptCompletedWorkers}/${config.userCount}`,
        );
        console.log(`   Duration: ${Date.now() - startTime}ms`);
        console.log(`   Total Sent: ${totalMessagesSent}`);
      }
    } else {
      // For non-wait mode, all promises have already resolved after sending
      console.log(
        `✅ All messages sent for attempt ${attempt} (no response waiting)`,
      );
    }

    // Clean up workers for this attempt to free resources
    console.log(`🧹 Cleaning up workers for attempt ${attempt}...`);
    await workerManager.terminateAll(true); // Delete databases to ensure fresh state

    // Add a small delay between attempts (except for the last one)
    if (attempt < config.attempts) {
      console.log(`⏳ Waiting 2 seconds before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Final summary if not already printed
  if (!summaryPrinted) {
    logSummary(
      allResults,
      completedWorkers,
      totalMessagesSent,
      startTime,
      firstMessageTime,
      lastMessageTime,
    );
  }

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
