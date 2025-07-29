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
// yarn send --address 0x194c31cae1418d5256e8c58e0d08aee1046c6ed0 --env production --users 500 --wait

// echo
// yarn send --address 0x7723d790a5e00b650bf146a0961f8bb148f0450c --env local --users 500 --wait

// group message
// yarn send --group-id fa5d8fc796bb25283dccbc1823823f75 --env production --message "Hello group!"

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  target: string;
  groupId?: string;
  message?: string;
  senderAddress?: string;
  tresshold: number;
  loggingLevel: LogLevel;
  waitForResponse: boolean;
}

function showHelp() {
  console.log(`
XMTP Send CLI - Message sending and testing

USAGE:
  yarn send [options]

OPTIONS:
  --address <address>     Target wallet address to send messages to
  --group-id <id>         Target group ID to send message to
  --message <text>        Custom message to send (required for group messages)
  --sender <address>      Wallet address to use as sender (must be group member)
  --env <environment>     XMTP environment (local, dev, production) [default: local]
  --users <count>         Number of users to simulate [default: 5]
  --tresshold <percent>   Success threshold percentage [default: 95]
  --wait                  Wait for responses from target
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  yarn send --address 0x1234... --env dev --users 10
  yarn send --address 0x1234... --env production --users 500 --wait
  yarn send --group-id abc123... --message "Hello group!" --sender 0x1234... --env production
  yarn send --help

ENVIRONMENT VARIABLES:
  ADDRESS               Default target address
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
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--address" && nextArg) {
      config.target = nextArg;
      i++;
    } else if (arg === "--group-id" && nextArg) {
      config.groupId = nextArg;
      i++;
    } else if (arg === "--message" && nextArg) {
      config.message = nextArg;
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
      "❌ Error: Cannot use both --group-id and --address. Choose one.",
    );
    process.exit(1);
  }

  if (!config.groupId && !config.target) {
    console.error("❌ Error: Either --group-id or --address is required");
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
  console.log(`🚀 Testing ${config.userCount} users on ${config.env} `);

  cleanupsendDatabases(config.env);

  // Initialize workers using the workers API
  console.log(`📋 Initializing ${config.userCount} workers concurrently...`);

  const logSummary = (
    results: Array<{
      success: boolean;
      sendTime: number;
      responseTime: number;
    }>,
    completedWorkers: number,
    totalMessagesSent: number,
    startTime: number,
    firstMessageTime: number,
    lastMessageTime: number,
  ) => {
    const successful = results.filter((r) => r.success);
    const successRate = (successful.length / config.userCount) * 100;
    const failed = config.userCount - successful.length;
    const duration = Date.now() - startTime;

    console.log(`\n📊 Summary:`);
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
      const messagesPerSecond = (
        totalMessagesSent /
        (totalSendTime / 1000)
      ).toFixed(2);

      console.log(`   Total Send Time: ${(totalSendTime / 1000).toFixed(2)}s`);
      console.log(`   Avg Send: ${(avgSend / 1000).toFixed(2)}s`);
      console.log(`   Messages/Second: ${messagesPerSecond}`);

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

  // Create worker manager and initialize workers
  const workerManager = await getWorkers(config.userCount, {
    env: config.env as XmtpEnv,
    useVersions: false, // Use latest version for send tests
  });

  const workers = workerManager.getAll();
  console.log(`\n✅ All ${config.userCount} workers initialized successfully`);

  // Run all workers in parallel
  console.log(`🔄 Starting parallel execution...`);

  // Shared counters
  let totalMessagesSent = 0;
  let completedWorkers = 0;
  let summaryPrinted = false;
  let firstMessageTime = 0;
  let lastMessageTime = 0;
  const results: Array<{
    success: boolean;
    sendTime: number;
    responseTime: number;
  }> = [];

  const promises = workers.map((worker, i) => {
    return new Promise<{
      success: boolean;
      sendTime: number;
      responseTime: number;
    }>((resolve) => {
      let responseReceived = false;
      let sendCompleteTime = 0;
      let sendTime = 0;

      const process = async () => {
        try {
          let conversation: Conversation;

          conversation = (await worker.client.conversations.newDmWithIdentifier(
            {
              identifier: config.target,
              identifierKind: IdentifierKind.Ethereum,
            },
          )) as Conversation;

          if (config.waitForResponse) {
            console.log(`📡 ${i}: Setting up message stream...`);
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
                  };
                  results.push(result);
                  completedWorkers++;

                  const successRate =
                    (results.filter((r) => r.success).length /
                      config.userCount) *
                    100;
                  console.log(
                    `✅ ${i}: Send=${sendTime}ms, Response=${responseTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
                  );

                  // Check if we've reached the success threshold
                  if (successRate >= config.tresshold && !summaryPrinted) {
                    console.log(
                      `🎯 Success threshold (${config.tresshold}%) reached! Exiting early.`,
                    );
                    summaryPrinted = true;
                    logSummary(
                      results,
                      completedWorkers,
                      totalMessagesSent,
                      startTime,
                      firstMessageTime,
                      lastMessageTime,
                    );
                  }

                  resolve(result);
                }
              },
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          console.log(`📤 ${i}: Sending test message...`);
          // 2. Time message send
          const sendStart = Date.now();
          await conversation.send(`test-${i}-${Date.now()}`);
          totalMessagesSent++;
          sendTime = Date.now() - sendStart;
          sendCompleteTime = Date.now();

          // Track first and last message times
          if (firstMessageTime === 0) {
            firstMessageTime = sendCompleteTime;
          }
          lastMessageTime = sendCompleteTime;

          console.log(
            `📩 ${i}: Message sent in ${sendTime}ms (Total sent: ${totalMessagesSent})`,
          );

          // If not waiting for response, resolve immediately
          if (!config.waitForResponse) {
            const result = {
              success: true,
              sendTime,
              responseTime: 0, // No response time when not waiting
            };
            results.push(result);
            completedWorkers++;

            const successRate =
              (results.filter((r) => r.success).length / config.userCount) *
              100;
            console.log(
              `✅ ${i}: Send=${sendTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
            );

            // Check if we've reached the success threshold
            if (successRate >= config.tresshold && !summaryPrinted) {
              console.log(
                `🎯 Success threshold (${config.tresshold}%) reached! Exiting early.`,
              );
              summaryPrinted = true;
              logSummary(
                results,
                completedWorkers,
                totalMessagesSent,
                startTime,
                firstMessageTime,
                lastMessageTime,
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
        };
        results.push(result);
        completedWorkers++;
        console.log(
          `❌ ${i}: Failed (${completedWorkers}/${config.userCount})`,
        );
        resolve(result);
      });
    });
  });

  // First, wait for all messages to be sent (no timeout for sending)
  console.log(`📤 Waiting for all messages to be sent...`);

  // For non-wait mode, promises resolve immediately after sending
  // For wait mode, promises resolve after receiving responses
  const sendPromises = promises.map((promise) =>
    promise.then((result) => result),
  );

  // Wait for all messages to be sent first (no timeout)
  await Promise.all(sendPromises);
  console.log(`✅ All messages sent successfully`);

  // Now start the timeout for waiting for responses (only relevant for wait mode)
  if (config.waitForResponse) {
    console.log(`⏳ Waiting for responses (timeout: ${config.timeout}ms)...`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Test timed out after ${config.timeout}ms`));
      }, config.timeout);
    });

    try {
      const finalResults = await Promise.race([
        Promise.all(promises),
        timeoutPromise,
      ]);

      if (!summaryPrinted) {
        logSummary(
          finalResults,
          completedWorkers,
          totalMessagesSent,
          startTime,
          firstMessageTime,
          lastMessageTime,
        );
      }
    } catch (error) {
      console.error(
        `\n⏰ ${error instanceof Error ? error.message : "Test timed out"}`,
      );
      console.log(`📊 Partial Summary:`);
      console.log(`   Completed: ${completedWorkers}/${config.userCount}`);
      console.log(`   Duration: ${Date.now() - startTime}ms`);
      console.log(`   Total Sent: ${totalMessagesSent}`);
    }
  } else {
    // For non-wait mode, all promises have already resolved after sending
    if (!summaryPrinted) {
      logSummary(
        results,
        completedWorkers,
        totalMessagesSent,
        startTime,
        firstMessageTime,
        lastMessageTime,
      );
    }
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
