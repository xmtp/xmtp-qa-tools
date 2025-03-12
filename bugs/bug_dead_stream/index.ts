import { exec } from "child_process";
import * as fs from "fs/promises";
import { promisify } from "util";
import {
  createSigner,
  createUser,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type LogLevel } from "@helpers/types";

const execAsync = promisify(exec);
const API_HOST = "grpc.dev.xmtp.network";
const testName = "bug_dead_stream";
loadEnv(testName);
const { WALLET_KEY, ENCRYPTION_KEY } = process.env;
if (!WALLET_KEY || !ENCRYPTION_KEY)
  throw new Error("Missing environment variables");

// Function to block the XMTP API by configuring proxy settings
async function blockXmtpApi() {
  console.log(`🚫 Blocking access to ${API_HOST}...`);

  try {
    // Get the active network service
    const { stdout: networkServices } = await execAsync(
      "networksetup -listallnetworkservices",
    );
    const activeService = networkServices.split("\n")[1]; // Usually the first non-header line

    console.log(`Using network service: ${activeService}`);

    // Save current proxy settings
    await fs.writeFile("/tmp/xmtp_proxy_backup", activeService);

    // Set a non-existent proxy to block connections
    await execAsync(
      `sudo networksetup -setwebproxy "${activeService}" 127.0.0.1 12345`,
    );
    await execAsync(
      `sudo networksetup -setsecurewebproxy "${activeService}" 127.0.0.1 12345`,
    );
    await execAsync(
      `sudo networksetup -setwebproxystate "${activeService}" on`,
    );
    await execAsync(
      `sudo networksetup -setsecurewebproxystate "${activeService}" on`,
    );

    console.log(`Access to ${API_HOST} blocked via proxy settings`);
  } catch (error) {
    console.error("Failed to block API:", error);
  }
}

// Function to restore proxy settings
async function unblockXmtpApi() {
  console.log(`✅ Restoring access to ${API_HOST}...`);

  try {
    // Read the saved network service
    const activeService = (
      await fs.readFile("/tmp/xmtp_proxy_backup", "utf8")
    ).trim();

    // Turn off proxy
    await execAsync(
      `sudo networksetup -setwebproxystate "${activeService}" off`,
    );
    await execAsync(
      `sudo networksetup -setsecurewebproxystate "${activeService}" off`,
    );

    console.log(`Proxy settings restored`);
  } catch (error) {
    console.error("Failed to restore proxy settings:", error);
  }
}

// Function to simulate API outage with transport error
async function simulateTransportError(durationMs = 10000) {
  console.log(`\n🔌 Simulating transport error for ${durationMs}ms...`);

  await blockXmtpApi();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  await unblockXmtpApi();

  // Give some time for connections to re-establish
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log(`🔌 Transport error simulation complete\n`);
}

(async () => {
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const client = await Client.create(
    signer,
    getEncryptionKeyFromHex(ENCRYPTION_KEY),
    { env: "dev", loggingLevel: "error" as LogLevel },
  );
  await client.conversations.sync();
  console.log(`Agent initialized on ${client.inboxId}`);
  console.log(
    `Send a message on http://xmtp.chat/dm/${client.inboxId}?env=dev`,
  );

  // Set up a timer to simulate transport error after 30 seconds
  setTimeout(async () => {
    console.log("Triggering scheduled transport error...");
    await simulateTransportError(15000); // 15 seconds of API downtime
  }, 30000);

  try {
    // Start message stream
    console.log("Starting message stream...");
    const messageStream = await client.conversations.streamAllMessages();

    for await (const message of messageStream) {
      if (
        message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      )
        continue;

      console.log(`Received message: "${message.content}"`);

      // Special command handling
      if (message.content.toLowerCase() === "!error") {
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        console.log("Manual transport error requested");
        await conversation?.send(
          "Simulating transport error for 10 seconds...",
        );
        await simulateTransportError(10000);
        continue;
      }

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      console.log(`Sending "gm" response...`);
      await conversation?.send("gm");
    }

    // If we get here, the stream ended naturally
    console.log(
      "Stream ended naturally. This is unexpected in normal operation.",
    );
  } catch (error) {
    console.error("Error in message stream:", error);
    console.log("Stream failed. This may be expected during API outages.");

    // Restart the process
    console.log(
      "Exiting process. Use a process manager to restart automatically.",
    );
    process.exit(1);
  }
})().catch(console.error);
