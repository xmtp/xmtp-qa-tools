import {
  Client,
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
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPathQA,
  getEncryptionKeyFromHex,
} from "../helpers/client";
import { getInboxIds, getRandomInboxIds } from "../inboxes/utils";

interface Config {
  operation: string;
  userCount: number;
  timeout: number;
  env: string;
  address: string;
  tresshold: number;
  loggingLevel: LogLevel;
  waitForResponse: boolean;
  groupName?: string;
  targetAddress?: string;
  members?: number;
}

function showHelp() {
  console.log(`
XMTP AI CLI - Multipurpose XMTP testing and operations

USAGE:
  yarn ai <operation> [options]

OPERATIONS:
  send                    Send messages to a target address
  group                   Create a group with random members and invite target
  dm                      Create direct message conversations
  stream                  Stream messages from conversations
  users                   Generate random test users
  help                    Show this help message

OPTIONS:
  --address <address>     Target wallet address
  --env <environment>     XMTP environment (local, dev, production) [default: local]
  --users <count>         Number of users to simulate [default: 5]
  --members <count>       Number of random members for groups [default: 5]
  --group-name <name>     Group name for group operations
  --target <address>      Target address to invite to group
  --tresshold <percent>   Success threshold percentage [default: 95]
  --wait                  Wait for responses from target
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  # Send messages to target
  yarn ai send --address 0x1234... --env dev --users 10
  
  # Create group with 5 random members and invite target
  yarn ai group --target 0xe709fDa144F82Fd0A250f4E6d052c41c98087cF5 --members 5 --group-name "Test Group"
  
  # Create DMs between users
  yarn ai dm --users 3
  
  # Stream messages
  yarn ai stream --env dev
  
  # Generate test users
  yarn ai users --count 10

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
    operation: "help",
    userCount: 5,
    timeout: 120 * 1000, // 120 seconds - increased for XMTP operations
    env: process.env.XMTP_ENV ?? "local",
    address: process.env.ADDRESS ?? "",
    tresshold: 95,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    waitForResponse: false,
    members: 5,
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.operation = args[0];
    args.shift(); // Remove operation from args
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--address" && nextArg) {
      config.address = nextArg;
      i++;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--members" && nextArg) {
      config.members = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--group-name" && nextArg) {
      config.groupName = nextArg;
      i++;
    } else if (arg === "--target" && nextArg) {
      config.targetAddress = nextArg;
      i++;
    } else if (arg === "--tresshold" && nextArg) {
      config.tresshold = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--wait") {
      config.waitForResponse = true;
    }
  }

  return config;
}

// Helper function to generate random Ethereum addresses
function generateRandomAddresses(count: number): string[] {
  const addresses: string[] = [];
  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    addresses.push(account.address);
  }
  return addresses;
}

// Helper function to create a client
async function createClient(
  index: number,
  env: string,
  loggingLevel?: LogLevel,
): Promise<Client> {
  const workerKey = generatePrivateKey();
  const signer = createSigner(workerKey);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const dbPath = getDbPathQA(`ai/${env}-${index}-${signerIdentifier}`);
  const sendDir = path.dirname(dbPath);
  if (!fs.existsSync(sendDir)) {
    fs.mkdirSync(sendDir, { recursive: true });
  }
  const dbEncryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());

  return await Client.create(signer, {
    env: env as XmtpEnv,
    dbPath,
    dbEncryptionKey,
    loggingLevel,
  });
}

// Helper function to calculate percentiles
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Operation: Send messages (existing functionality)
async function runSendOperation(config: Config): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 Testing ${config.userCount} users on ${config.env} `);

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

  const workerPromises = Array.from(
    { length: config.userCount },
    async (_, i) => {
      const client = await createClient(i, config.env, config.loggingLevel);
      initializedCount++;
      updateProgress();
      return client;
    },
  );

  const workers = await Promise.all(workerPromises);
  console.log(`\n✅ All ${config.userCount} workers initialized successfully`);

  // Run all workers in parallel
  console.log(`🔄 Starting parallel execution...`);

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
            void worker.conversations.streamAllMessages({
              onValue: (message: DecodedMessage) => {
                if (
                  message.senderInboxId.toLowerCase() !==
                    worker.inboxId.toLowerCase() &&
                  !responseReceived
                ) {
                  responseReceived = true;
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
          const sendStart = Date.now();
          await conversation.send(`test-${i}-${Date.now()}`);
          totalMessagesSent++;
          sendTime = Date.now() - sendStart;
          sendCompleteTime = Date.now();

          if (firstMessageTime === 0) {
            firstMessageTime = sendCompleteTime;
          }
          lastMessageTime = sendCompleteTime;

          console.log(
            `📩 ${i}: Message sent in ${sendTime}ms (Total sent: ${totalMessagesSent})`,
          );

          if (!config.waitForResponse) {
            const result = {
              success: true,
              sendTime,
              responseTime: 0,
            };
            results.push(result);
            completedWorkers++;

            const successRate =
              (results.filter((r) => r.success).length / config.userCount) *
              100;
            console.log(
              `✅ ${i}: Send=${sendTime}ms (${completedWorkers}/${config.userCount}, ${successRate.toFixed(1)}% success)`,
            );

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

  console.log(`📤 Waiting for all messages to be sent...`);
  const sendPromises = promises.map((promise) =>
    promise.then((result) => result),
  );

  await Promise.all(sendPromises);
  console.log(`✅ All messages sent successfully`);

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
}

// Operation: Create group with random members and invite target
async function runGroupOperation(config: Config): Promise<void> {
  if (!config.targetAddress) {
    console.error(
      "❌ Target address is required for group operations. Use --target <address>",
    );
    process.exit(1);
  }

  console.log(
    `🏗️  Creating group with ${config.members} random members and inviting ${config.targetAddress}`,
  );

  // Create main client
  const mainClient = await createClient(0, config.env, config.loggingLevel);
  console.log(`✅ Main client created: ${mainClient.inboxId}`);

  // Get existing inbox IDs for group members
  const memberInboxIds = getRandomInboxIds(config.members || 5, 2);
  console.log(`📋 Using ${memberInboxIds.length} existing inbox IDs`);

  // Create group with random members
  const groupName = config.groupName || `Test Group ${Date.now()}`;
  console.log(`👥 Creating group: "${groupName}"`);

  try {
    // Create group with existing inbox IDs
    const group = (await mainClient.conversations.newGroup(memberInboxIds, {
      groupName,
      groupDescription: "Group created by AI CLI",
    })) as Group;

    console.log(`✅ Group created with ID: ${group.id}`);

    // Add target address to the group
    console.log(`🎯 Adding target address: ${config.targetAddress}`);
    await group.addMembersByIdentifiers([
      {
        identifier: config.targetAddress,
        identifierKind: IdentifierKind.Ethereum,
      },
    ]);

    // Sync group to get updated member list
    await group.sync();
    const members = await group.members();

    console.log(`\n📊 Group Summary:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Group Name: ${group.name}`);
    console.log(`   Total Members: ${members.length}`);
    console.log(`   Random Members: ${memberInboxIds.length}`);
    console.log(`   Target Member: ${config.targetAddress}`);

    // Send welcome message to group
    const welcomeMessage = `Welcome to ${groupName}! This group was created by the AI CLI with ${members.length} members.`;
    await group.send(welcomeMessage);
    console.log(`💬 Sent welcome message to group`);

    // Make target address an admin
    try {
      await group.addAdmin(config.targetAddress);
      console.log(`👑 Made ${config.targetAddress} an admin`);
    } catch (error) {
      console.warn(`⚠️  Could not make target admin: ${error}`);
    }

    console.log(`\n🎉 Group operation completed successfully!`);
    console.log(
      `   Group can be accessed at: https://xmtp.chat/conversations/${group.id}`,
    );
  } catch (error) {
    console.error(`❌ Failed to create group: ${error}`);
    process.exit(1);
  }
}

// Operation: Create DMs between users
async function runDmOperation(config: Config): Promise<void> {
  console.log(`💬 Creating ${config.userCount} users and DMs between them`);

  // Create users
  const users: Client[] = [];
  for (let i = 0; i < config.userCount; i++) {
    const client = await createClient(i, config.env, config.loggingLevel);
    users.push(client);
    console.log(`✅ Created user ${i + 1}: ${client.inboxId}`);
  }

  // Create DMs between users
  const conversations: Conversation[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      try {
        const conversation = await users[i].conversations.newDm(
          users[j].inboxId,
        );
        conversations.push(conversation);
        console.log(`💬 Created DM between user ${i + 1} and user ${j + 1}`);

        // Send a test message
        await conversation.send(`Hello from user ${i + 1} to user ${j + 1}!`);
        console.log(`📤 Sent test message from user ${i + 1} to user ${j + 1}`);
      } catch (error) {
        console.warn(
          `⚠️  Failed to create DM between user ${i + 1} and user ${j + 1}: ${error}`,
        );
      }
    }
  }

  console.log(`\n📊 DM Summary:`);
  console.log(`   Users Created: ${users.length}`);
  console.log(`   Conversations Created: ${conversations.length}`);
  console.log(
    `   Expected Conversations: ${(users.length * (users.length - 1)) / 2}`,
  );
}

// Operation: Stream messages
async function runStreamOperation(config: Config): Promise<void> {
  console.log(`📡 Starting message stream on ${config.env}`);

  const client = await createClient(0, config.env, config.loggingLevel);
  console.log(`✅ Client created: ${client.inboxId}`);

  console.log(`🔄 Starting message stream...`);
  console.log(`   Press Ctrl+C to stop streaming`);

  const stream = await client.conversations.streamAllMessages();

  let messageCount = 0;
  for await (const message of stream) {
    messageCount++;
    console.log(`\n📨 Message ${messageCount}:`);
    console.log(`   From: ${message.senderInboxId}`);
    console.log(`   Content: ${String(message.content)}`);
    console.log(`   Conversation: ${message.conversationId}`);
  }
}

// Operation: Generate test users
async function runUsersOperation(config: Config): Promise<void> {
  console.log(`👥 Generating ${config.userCount} test users`);

  const users: Array<{
    index: number;
    address: string;
    inboxId: string;
    privateKey: string;
    encryptionKey: string;
  }> = [];

  for (let i = 0; i < config.userCount; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const address = account.address;
    const encryptionKey = generateEncryptionKeyHex();

    // Create client to get inbox ID
    const client = await createClient(i, config.env, config.loggingLevel);
    const inboxId = client.inboxId;

    users.push({
      index: i + 1,
      address,
      inboxId,
      privateKey,
      encryptionKey,
    });

    console.log(`✅ User ${i + 1}:`);
    console.log(`   Address: ${address}`);
    console.log(`   Inbox ID: ${inboxId}`);
    console.log(`   Private Key: ${privateKey}`);
    console.log(`   Encryption Key: ${encryptionKey}`);
    console.log(``);
  }

  // Save users to file
  const outputFile = `./test-users-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(users, null, 2));
  console.log(`💾 Saved ${users.length} users to ${outputFile}`);
}

function logSummary(
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
) {
  const successful = results.filter((r) => r.success);
  const successRate = (successful.length / results.length) * 100;
  const failed = results.length - successful.length;
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

    if (results.some((r) => r.responseTime > 0)) {
      const responseTimes = successful.map((r) => r.responseTime);
      const avgResponse =
        responseTimes.reduce((sum, time) => sum + time, 0) / successful.length;
      console.log(`   Avg Response: ${(avgResponse / 1000).toFixed(2)}s`);

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
}

async function main(): Promise<void> {
  const config = parseArgs();

  switch (config.operation) {
    case "send":
      await runSendOperation(config);
      break;
    case "group":
      await runGroupOperation(config);
      break;
    case "dm":
      await runDmOperation(config);
      break;
    case "stream":
      await runStreamOperation(config);
      break;
    case "users":
      await runUsersOperation(config);
      break;
    case "help":
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void main();
