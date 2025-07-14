import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import "dotenv/config";

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
    timeout: 60000, // 60 seconds
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
  const names = Array.from({ length: config.userCount }, (_, i) => `test${i}`);
  const workers = await getWorkers(names, { env: config.env as XmtpEnv });

  // Run all workers in parallel
  const promises = workers.getAll().map((worker: any, index: number) => {
    return new Promise<boolean>((resolve) => {
      let responseReceived = false;
      let streamCanceller: any = null;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          console.log(`❌ Worker ${index} timed out`);
          if (streamCanceller && typeof streamCanceller === "function") {
            streamCanceller();
          }
          resolve(false);
        }
      }, config.timeout);

      const process = async () => {
        try {
          // Create DM
          const conversation =
            (await worker.client.conversations.newDmWithIdentifier({
              identifier: config.botAddress,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;

          // Set up stream
          streamCanceller = worker.client.conversations.streamAllMessages(
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
                if (streamCanceller && typeof streamCanceller === "function") {
                  streamCanceller();
                }
                console.log(
                  `✅ Worker ${index} got response: "${message.content}"`,
                );
                resolve(true);
              }
            },
          );

          // Send message
          await conversation.send(`test-${index}-${Date.now()}`);
        } catch (error) {
          console.log(`❌ Worker ${index} failed:`, error);
          clearTimeout(timeout);
          if (streamCanceller && typeof streamCanceller === "function") {
            streamCanceller();
          }
          resolve(false);
        }
      };

      process().catch(() => {
        resolve(false);
      });
    });
  });

  // Wait for all workers
  const results = await Promise.all(promises);
  const successful = results.filter(Boolean).length;

  console.log(
    `📊 Results: ${successful}/${config.userCount} successful (${Math.round((successful / config.userCount) * 100)}%)`,
  );
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
