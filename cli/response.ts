#!/usr/bin/env node
import { Agent } from "@helpers/versions";
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load .env file
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

// Examples:
// yarn response --target 0xf1be9a945de5e4e270321cf47672f82380fd3463 --env dev
// yarn response --target 0x7723d790a5e00b650bf146a0961f8bb148f0450c --env local --message "Hello agent!"
// yarn response --target 0xadc58094c42e2a8149d90f626a1d6cfb4a79f002 --env production --timeout 30000

interface Config {
  target: string;
  env: string;
  message?: string;
  timeout: number;
}

function parseArgs(): Config {
  const argv = yargs(hideBin(process.argv))
    .scriptName("yarn response")
    .usage("$0 [options]")
    .command("$0", "XMTP Response CLI - Test agent response times", (yargs) => {
      return yargs;
    })
    .option("target", {
      alias: "t",
      type: "string",
      description: "Target agent Ethereum address",
      default: process.env.TARGET ?? "",
    })
    .option("message", {
      alias: "m",
      type: "string",
      description: "Message to send to the agent",
      default: `test-${Date.now()}`,
    })
    .option("env", {
      alias: "e",
      type: "string",
      choices: ["local", "dev", "production"],
      description: "XMTP environment",
      default: process.env.XMTP_ENV ?? "production",
    })
    .option("timeout", {
      type: "number",
      description: "Response timeout in milliseconds",
      default: 60000, // 60 seconds
    })
    .check((argv) => {
      if (!argv.target) {
        throw new Error("--target is required");
      }

      if (argv.timeout && argv.timeout < 1000) {
        throw new Error("--timeout must be at least 1000ms");
      }

      return true;
    })
    .help("help")
    .alias("help", "h")
    .example(
      "$0 --target 0x1234... --env dev",
      "Test agent response time on dev network",
    )
    .example(
      "$0 --target 0x1234... --message 'Hello!' --env production --timeout 30000",
      "Send custom message with 30s timeout",
    )
    .epilogue(
      `ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network
  production  Production XMTP network

ENVIRONMENT VARIABLES:
  TARGET               Default target address
  XMTP_ENV             Default environment

For more information, see: cli/readme.md`,
    )
    .strict()
    .parseSync();

  const config: Config = {
    target: argv.target ?? process.env.TARGET ?? "",
    env: argv.env ?? process.env.XMTP_ENV ?? "production",
    message: argv.message,
    timeout: argv.timeout ?? 60000,
  };

  return config;
}

async function testAgentResponse(config: Config): Promise<void> {
  console.log(`🚀 Testing agent response time`);
  console.log(`   Target: ${config.target}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Timeout: ${config.timeout}ms`);
  console.log(`   Message: "${config.message}"`);

  // Create agent from environment
  const agent = await Agent.createFromEnv({
    env: config.env as "local" | "dev" | "production",
  });

  // Start the agent
  await agent.start();

  console.log(`   Sender Inbox ID: ${agent.client.inboxId}`);
  console.log(`   Sender Address: ${agent.address}`);

  try {
    // Create DM conversation with target agent by address
    console.log(`\n📬 Creating DM conversation...`);
    const dm = await agent.createDmWithAddress(config.target as `0x${string}`);

    // Get destination information
    const destinationInboxId = dm.peerInboxId;
    const destinationAddress = config.target;

    // Log conversation details
    console.log(`\n📋 Conversation Details:`);
    console.log(`   DM ID: ${dm.id}`);
    console.log(`   Origin Address: ${agent.address}`);
    console.log(`   Origin Inbox ID: ${agent.client.inboxId}`);
    console.log(`   Destination Address: ${destinationAddress}`);
    console.log(`   Destination Inbox ID: ${destinationInboxId}`);

    // Set up message stream before sending
    console.log(`\n📤 Sending message...`);
    const stream = await dm.stream();

    // Send message
    const sendStart = Date.now();
    await dm.send(config.message || `test-${Date.now()}`);
    const sendTime = Date.now() - sendStart;

    console.log(`   Message sent in ${sendTime}ms`);

    // Start timing response after message is sent
    const responseStartTime = Date.now();
    let responseTime = 0;
    let responseMessage: any = null;

    // Wait for response with timeout
    console.log(`\n⏳ Waiting for agent response...`);
    try {
      await Promise.race([
        // Wait for response from stream
        (async () => {
          for await (const message of stream) {
            // Skip if the message is from the agent itself
            if (
              message.senderInboxId.toLowerCase() ===
              agent.client.inboxId.toLowerCase()
            ) {
              continue;
            }

            // Got a response from the destination
            responseTime = Date.now() - responseStartTime;
            responseMessage = message as any;
            break;
          }
        })(),
        // Timeout
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Response timeout"));
          }, config.timeout);
        }),
      ]);

      // Log response details
      console.log(`\n✅ Response received!`);
      console.log(
        `   Response Time: ${responseTime}ms (${(responseTime / 1000).toFixed(2)}s)`,
      );
      console.log(
        `   Send Time: ${sendTime}ms (${(sendTime / 1000).toFixed(2)}s)`,
      );
      console.log(
        `   Total Time: ${sendTime + responseTime}ms (${((sendTime + responseTime) / 1000).toFixed(2)}s)`,
      );

      if (responseMessage) {
        const messageContent =
          typeof responseMessage.content === "string"
            ? responseMessage.content
            : JSON.stringify(responseMessage.content);
        console.log(
          `   Response Content: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? "..." : ""}"`,
        );
      }

      // Final summary
      console.log(`\n📊 Summary:`);
      console.log(`   Origin Address: ${agent.address}`);
      console.log(`   Destination Inbox ID: ${destinationInboxId}`);
      console.log(`   Destination Address: ${destinationAddress}`);
      console.log(`   DM ID: ${dm.id}`);
      console.log(`   Response Time: ${responseTime}ms`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`\n❌ ${errorMessage}`);
      console.log(`\n📊 Summary (no response):`);
      console.log(`   Origin Address: ${agent.address}`);
      console.log(`   Destination Inbox ID: ${destinationInboxId}`);
      console.log(`   Destination Address: ${destinationAddress}`);
      console.log(`   DM ID: ${dm.id}`);
      console.log(`   Response Time: N/A (timeout)`);
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${errorMessage}`);
    process.exit(1);
  } finally {
    // Stop the agent
    try {
      await agent.stop();
    } catch (error) {
      console.error(`Warning: Error stopping agent:`, error);
    }
  }

  process.exit(0);
}

async function main(): Promise<void> {
  const config = parseArgs();
  await testAgentResponse(config);
}

void main();
