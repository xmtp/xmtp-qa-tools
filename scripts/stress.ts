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

// yarn stress --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5
// yarn stress --address 0x362d666308d90e049404d361b29c41bda42dd38b --users 5 --env production

interface Config {
  userCount: number;
  timeout: number;
  env: string;
  address: string;
  tresshold: number;
  keepDb: boolean;
  loggingLevel: LogLevel;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    timeout: 30 * 1000, // 120 seconds - increased for XMTP operations
    env: process.env.XMTP_ENV ?? "local",
    address: process.env.ADDRESS ?? "",
    tresshold: 95,
    keepDb: false,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
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
    if (arg === "--keep-db") {
      config.keepDb = true;
    }
  }

  return config;
}

function cleanupStressDatabases(env: string): void {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  const dataDir = path.resolve(volumePath);

  if (!fs.existsSync(dataDir)) {
    console.log(`🧹 No data directory found at ${dataDir}, skipping cleanup`);
    return;
  }

  try {
    const files = fs.readdirSync(dataDir);
    const stressFiles = files.filter((file) => file.startsWith(`stress-`));

    if (stressFiles.length === 0) {
      console.log(`🧹 No stress test database files found for env: ${env}`);
      return;
    }

    console.log(
      `🧹 Cleaning up ${stressFiles.length} stress test database files...`,
    );

    for (const file of stressFiles) {
      const filePath = path.join(dataDir, file);
      fs.unlinkSync(filePath);
    }

    console.log(
      `🗑️  Removed: ${stressFiles.length} stress test database files`,
    );
  } catch (error) {
    console.error(`❌ Error during cleanup:`, error);
  }
}

async function runStressTest(config: Config): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 Testing ${config.userCount} users against `);

  // Clean up previous stress test database files
  if (!config.keepDb) {
    cleanupStressDatabases(config.env);
  }

  const dbEncryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());

  // Initialize workers concurrently
  console.log(`📋 Initializing ${config.userCount} workers concurrently...`);

  const workerPromises = Array.from(
    { length: config.userCount },
    async (_, i) => {
      const workerKey = generatePrivateKey();
      const signer = createSigner(workerKey);
      const signerIdentifier = (await signer.getIdentifier()).identifier;

      const client = await Client.create(signer, {
        env: config.env as XmtpEnv,
        dbPath: getDbPath(`stress-${config.env}-${i}-${signerIdentifier}`),
        dbEncryptionKey,
        loggingLevel: config.loggingLevel,
      });

      console.log(`✅ ${i} initialized successfully`);
      return client;
    },
  );

  const workers = await Promise.all(workerPromises);
  console.log(`✅ All ${config.userCount} workers initialized successfully`);

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
          // 1. Time NewDM creation
          const newDmStart = Date.now();
          const conversation = (await worker.conversations.newDmWithIdentifier({
            identifier: config.address,
            identifierKind: IdentifierKind.Ethereum,
          })) as Conversation;
          const newDmTime = Date.now() - newDmStart;
          console.log(`💬 ${i}: DM created in ${newDmTime}ms`);

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
                  (results.filter((r) => r.success).length / config.userCount) *
                  100;
                console.log(
                  `✅ ${i}: NewDM=${newDmTime}ms, Send=${sendTime}ms, Response=${responseTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
                );

                resolve(result);
              }
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));

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

  // Wait for all workers to complete
  console.log(`⏳ Waiting for all workers to complete...`);

  const finalResults = await Promise.all(promises);
  const successful = finalResults.filter((r) => r.success);
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
    const avgResponse =
      successful.reduce((sum, r) => sum + r.responseTime, 0) /
      successful.length;

    console.log(`   Avg NewDM: ${Math.round(avgNewDm)}ms`);
    console.log(`   Avg Send: ${Math.round(avgSend)}ms`);
    console.log(`   Avg Response: ${Math.round(avgResponse)}ms`);
  }

  process.exit(0);
}

async function main(): Promise<void> {
  const config = parseArgs();
  await runStressTest(config);
}

void main();
