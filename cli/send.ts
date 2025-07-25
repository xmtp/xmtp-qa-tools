import {
  Client,
  IdentifierKind,
  type Conversation,
  type LogLevel,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey } from "viem/accounts";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
} from "../helpers/client";
import { getRandomInboxIds } from "../inboxes/utils";

// yarn send --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5
// yarn send --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5 --env production
// yarn send --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5 --wait
// yarn send --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5 --groups

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  address: string;
  tresshold: number;
  keepDb: boolean;
  loggingLevel: LogLevel;
  waitForResponse: boolean;
  useGroups: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    timeout: 120 * 1000, // 120 seconds - increased for XMTP operations
    env: process.env.XMTP_ENV ?? "local",
    address: process.env.ADDRESS ?? "",
    tresshold: 95,

    keepDb: false,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    waitForResponse: false,
    useGroups: false,
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
    if (arg === "--keep") {
      config.keepDb = true;
    }
    if (arg === "--wait") {
      config.waitForResponse = true;
    }
    if (arg === "--groups") {
      config.useGroups = true;
    }
  }

  return config;
}

function cleanupsendDatabases(env: string): void {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  const dataDir = path.resolve(volumePath);

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

  // Clean up previous send test database files
  if (!config.keepDb) {
    cleanupsendDatabases(config.env);
  }

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
      newDmTime: number;
      sendTime: number;
      responseTime: number;
    }>,
    completedWorkers: number,
    totalMessagesSent: number,
    startTime: number,
  ) => {
    const successful = results.filter((r) => r.success);
    const successRate = (successful.length / config.userCount) * 100;
    const failed = config.userCount - successful.length;
    const duration = Date.now() - startTime;

    console.log(`\n📊 Summary:`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Total: ${totalMessagesSent}`);

    if (successful.length > 0) {
      const avgNewDm =
        successful.reduce((sum, r) => sum + r.newDmTime, 0) / successful.length;
      const avgSend =
        successful.reduce((sum, r) => sum + r.sendTime, 0) / successful.length;

      console.log(`   Avg NewDM: ${Math.round(avgNewDm)}ms`);
      console.log(`   Avg Send: ${Math.round(avgSend)}ms`);

      if (config.waitForResponse) {
        const avgResponse =
          successful.reduce((sum, r) => sum + r.responseTime, 0) /
          successful.length;
        console.log(`   Avg Response: ${Math.round(avgResponse)}ms`);

        // Calculate and log percentiles for response times
        const responseTimes = successful.map((r) => r.responseTime);
        const p80 = calculatePercentile(responseTimes, 80);
        const p95 = calculatePercentile(responseTimes, 95);
        const p99 = calculatePercentile(responseTimes, 99);

        console.log(`   Response Time Percentiles:`);
        console.log(`     P80: ${Math.round(p80)}ms`);
        console.log(`     P95: ${Math.round(p95)}ms`);
        console.log(`     P99: ${Math.round(p99)}ms`);
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
      const dbPath = getDbPath(`send/${config.env}-${i}-${signerIdentifier}`);
      const sendDir = path.dirname(dbPath);
      if (!fs.existsSync(sendDir)) {
        fs.mkdirSync(sendDir, { recursive: true });
      }
      const client = await Client.create(signer, {
        env: config.env as XmtpEnv,
        dbPath: getDbPath(`send/${config.env}-${i}-${signerIdentifier}`),
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
  const results: Array<{
    success: boolean;
    newDmTime: number;
    sendTime: number;
    responseTime: number;
  }> = [];

  const promises = workers.map((worker, i) => {
    return new Promise<{
      success: boolean;
      newDmTime: number;
      sendTime: number;
      responseTime: number;
    }>((resolve) => {
      let responseReceived = false;
      let sendCompleteTime = 0;
      let sendTime = 0;

      const process = async () => {
        try {
          // 1. Time conversation creation
          const newDmStart = Date.now();
          let conversation: Conversation;

          if (config.useGroups) {
            const groupMembers = getRandomInboxIds(4);
            conversation = (await worker.conversations.newGroup(
              groupMembers,
            )) as Conversation;
            console.log(
              `💬 ${i}: Group created in ${Date.now() - newDmStart}ms`,
            );
          } else {
            // Create DM
            conversation = (await worker.conversations.newDmWithIdentifier({
              identifier: config.address,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;
            console.log(`💬 ${i}: DM created in ${Date.now() - newDmStart}ms`);
          }

          const newDmTime = Date.now() - newDmStart;

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
                    newDmTime,
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
                    `✅ ${i}: NewDM=${newDmTime}ms, Send=${sendTime}ms, Response=${responseTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
                  );

                  // Check if we've reached the success threshold
                  if (successRate >= config.tresshold) {
                    console.log(
                      `🎯 Success threshold (${config.tresshold}%) reached! Exiting early.`,
                    );
                    logSummary(
                      results,
                      completedWorkers,
                      totalMessagesSent,
                      startTime,
                    );
                    process.exit(0);
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
          console.log(
            `📩 ${i}: Message sent in ${sendTime}ms (Total sent: ${totalMessagesSent})`,
          );

          // If not waiting for response, resolve immediately
          if (!config.waitForResponse) {
            const result = {
              success: true,
              newDmTime,
              sendTime,
              responseTime: 0, // No response time when not waiting
            };
            results.push(result);
            completedWorkers++;

            const successRate =
              (results.filter((r) => r.success).length / config.userCount) *
              100;
            console.log(
              `✅ ${i}: NewDM=${newDmTime}ms, Send=${sendTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
            );

            // Check if we've reached the success threshold
            if (successRate >= config.tresshold) {
              console.log(
                `🎯 Success threshold (${config.tresshold}%) reached! Exiting early.`,
              );
              logSummary(
                results,
                completedWorkers,
                totalMessagesSent,
                startTime,
              );
              process.exit(0);
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
          newDmTime: 0,
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

      logSummary(finalResults, completedWorkers, totalMessagesSent, startTime);
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
    logSummary(results, completedWorkers, totalMessagesSent, startTime);
  }

  process.exit(0);
}

async function main(): Promise<void> {
  const config = parseArgs();
  await runsendTest(config);
}

void main();
