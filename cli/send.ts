import {
  Client,
  IdentifierKind,
  type Conversation,
  type LogLevel,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey } from "viem/accounts";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPathQA,
  getEncryptionKeyFromHex,
} from "../helpers/client";

// gm-bot
// yarn send --address 0x194c31cae1418d5256e8c58e0d08aee1046c6ed0 --env production --users 500 --wait

// echo
// yarn send --address 0x7723d790a5e00b650bf146a0961f8bb148f0450c --env local --users 500 --wait

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  address: string;
  tresshold: number;
  loggingLevel: LogLevel;
  waitForResponse: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    timeout: 120 * 1000, // 120 seconds - increased for XMTP operations
    env: process.env.XMTP_ENV ?? "local",
    address: process.env.ADDRESS ?? "",
    tresshold: 95,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    waitForResponse: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--address" && nextArg) {
      config.address = nextArg;
      i++;
    }
    if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    }
    if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    }
    if (arg === "--tresshold" && nextArg) {
      config.tresshold = parseInt(nextArg, 10);
      i++;
    }
    if (arg === "--wait") {
      config.waitForResponse = true;
    }
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

async function runsendTest(config: Config): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 Testing ${config.userCount} users on ${config.env} `);

  cleanupsendDatabases(config.env);

  const dbEncryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());

  // Initialize workers concurrently
  console.log(`📋 Initializing ${config.userCount} workers concurrently...`);

  let initializedCount = 0;
  const updateProgress = () => {
    const percentage = Math.round((initializedCount / config.userCount) * 100);
    const filled = Math.round((percentage / 100) * 20);
    const empty = 20 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    process.stdout.write(
      `\r📋 [${bar}] ${percentage}% (${initializedCount}/${config.userCount} workers)`,
    );
  };

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

  const workerPromises = Array.from(
    { length: config.userCount },
    async (_, i) => {
      const workerKey = generatePrivateKey();
      const signer = createSigner(workerKey);
      const signerIdentifier = (await signer.getIdentifier()).identifier;
      // Create send directory in data path if it doesn't exist
      const dbPath = getDbPathQA(`send/${config.env}-${i}-${signerIdentifier}`);
      const sendDir = path.dirname(dbPath);
      if (!fs.existsSync(sendDir)) {
        fs.mkdirSync(sendDir, { recursive: true });
      }
      const client = await Client.create(signer, {
        env: config.env as XmtpEnv,
        dbPath,
        dbEncryptionKey,
        loggingLevel: config.loggingLevel,
      });

      initializedCount++;
      updateProgress();
      return client;
    },
  );

  const workers = await Promise.all(workerPromises);
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

          conversation = (await worker.conversations.newDmWithIdentifier({
            identifier: config.address,
            identifierKind: IdentifierKind.Ethereum,
          })) as Conversation;

          if (config.waitForResponse) {
            console.log(`📡 ${i}: Setting up message stream...`);
            // Set up stream
            void worker.conversations.streamAllMessages(
              (error: any, message: any) => {
                if (error) return;

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
            );
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
  await runsendTest(config);
}

void main();
