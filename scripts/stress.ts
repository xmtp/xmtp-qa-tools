import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import "dotenv/config";
import { setupPrettyLogs } from "../helpers/logger";

setupPrettyLogs("stress");

// yarn stress --address 0x7b422dbd911043f27f6d891365f636cf4fe3fb0e --users 5

interface Config {
  userCount: number;
  botAddress: string;
  timeout: number;
  env: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    userCount: 5,
    botAddress: "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d",
    timeout: 20000, // 60 seconds
    env: "production",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--users" && nextArg) {
      config.userCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--address" && nextArg) {
      config.botAddress = nextArg;
      i++;
    } else if (arg === "--timeout" && nextArg) {
      config.timeout = parseInt(nextArg, 10) * 1000;
      i++;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    }
  }

  return config;
}

async function runStressTest(config: Config): Promise<void> {
  console.log(
    `🚀 Testing ${config.userCount} users against ${config.botAddress}`,
  );

  // Initialize workers
  console.log(`📋 Initializing ${config.userCount} workers...`);
  const names = Array.from({ length: config.userCount }, (_, i) => `test${i}`);
  const workers = await getWorkers(names, { env: config.env as any });
  console.log(`✅ Workers initialized successfully`);

  // Run all workers in parallel
  console.log(`🔄 Starting parallel worker execution...`);
  const promises = workers.getAll().map((worker: any, index: number) => {
    return new Promise<{
      success: boolean;
      newDmTime: number;
      sendTime: number;
      responseTime: number;
    }>((resolve) => {
      let responseReceived = false;
      let sendCompleteTime = 0;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          console.log(`❌ Worker ${index} timed out`);
          resolve({
            success: false,
            newDmTime: 0,
            sendTime: 0,
            responseTime: 0,
          });
        }
      }, config.timeout);

      const process = async () => {
        try {
          console.log(`🔧 Worker ${index}: Creating new DM...`);
          // 1. Time NewDM creation
          const newDmStart = Date.now();
          const conversation =
            (await worker.client.conversations.newDmWithIdentifier({
              identifier: config.botAddress,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;
          const newDmTime = Date.now() - newDmStart;
          console.log(`💬 Worker ${index}: DM created in ${newDmTime}ms`);

          console.log(`📡 Worker ${index}: Setting up message stream...`);
          // Set up stream
          worker.client.conversations.streamAllMessages(
            (error: any, message: any) => {
              if (error) return;

              // Check for bot response
              if (
                message.senderInboxId.toLowerCase() !==
                  worker.client.inboxId.toLowerCase() &&
                !responseReceived
              ) {
                responseReceived = true;
                clearTimeout(timeout);

                // 3. Calculate response time
                const responseTime = Date.now() - sendCompleteTime;
                console.log(
                  `🎉 Worker ${index}: Bot responded in ${responseTime}ms`,
                );
                console.log(
                  `✅ Worker ${index}: NewDM=${newDmTime}ms, Send=${sendTime}ms, Response=${responseTime}ms`,
                );
                resolve({ success: true, newDmTime, sendTime, responseTime });
              }
            },
          );

          console.log(`📤 Worker ${index}: Sending test message...`);
          // 2. Time message send
          const sendStart = Date.now();
          await conversation.send(`test-${index}-${Date.now()}`);
          const sendTime = Date.now() - sendStart;
          sendCompleteTime = Date.now();
          console.log(`📩 Worker ${index}: Message sent in ${sendTime}ms`);
          console.log(`⏳ Worker ${index}: Waiting for bot response...`);
        } catch (error) {
          console.log(`❌ Worker ${index} failed:`, error);
          clearTimeout(timeout);
          resolve({
            success: false,
            newDmTime: 0,
            sendTime: 0,
            responseTime: 0,
          });
        }
      };

      process().catch(() => {
        resolve({ success: false, newDmTime: 0, sendTime: 0, responseTime: 0 });
      });
    });
  });

  // Wait for all workers
  console.log(`⏳ Waiting for all workers to complete...`);
  const results = await Promise.all(promises);
  console.log(`🏁 All workers completed`);

  const successful = results.filter((r) => r.success);

  console.log(
    `📊 Results: ${successful.length}/${config.userCount} successful (${Math.round((successful.length / config.userCount) * 100)}%)`,
  );

  if (successful.length > 0) {
    const avgNewDm =
      successful.reduce((sum, r) => sum + r.newDmTime, 0) / successful.length;
    const avgSend =
      successful.reduce((sum, r) => sum + r.sendTime, 0) / successful.length;
    const avgResponse =
      successful.reduce((sum, r) => sum + r.responseTime, 0) /
      successful.length;

    console.log(
      `📈 Averages: NewDM=${Math.round(avgNewDm)}ms, Send=${Math.round(avgSend)}ms, Response=${Math.round(avgResponse)}ms`,
    );
  }
  process.exit(0);
}

async function main(): Promise<void> {
  try {
    const config = parseArgs();
    await runStressTest(config);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
