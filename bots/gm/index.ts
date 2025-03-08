import { exec } from "child_process";
import { promisify } from "util";
import {
  createSigner,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client } from "@helpers/types";

const execAsync = promisify(exec);
const API_HOST = "grpc.dev.xmtp.network";

loadEnv("gm-bot");
const { WALLET_KEY, ENCRYPTION_KEY } = process.env;
if (!WALLET_KEY || !ENCRYPTION_KEY)
  throw new Error("Missing environment variables");

// Function to block the XMTP API using /etc/hosts
async function blockXmtpApi() {
  console.log(`🚫 Blocking access to ${API_HOST}...`);

  try {
    // Add entry to /etc/hosts to redirect the API domain to localhost
    await execAsync(`sudo sh -c 'echo "127.0.0.1 ${API_HOST}" >> /etc/hosts'`);

    // Flush DNS cache
    await execAsync(
      "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder",
    );

    console.log(`Access to ${API_HOST} blocked via /etc/hosts`);
  } catch (error) {
    console.error("Failed to block API:", error);
  }
}

// Function to unblock the XMTP API
async function unblockXmtpApi() {
  console.log(`✅ Restoring access to ${API_HOST}...`);

  try {
    // Remove the entry from /etc/hosts
    await execAsync(`sudo sed -i '' '/${API_HOST}/d' /etc/hosts`);

    // Flush DNS cache
    await execAsync(
      "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder",
    );

    console.log(`Access to ${API_HOST} restored`);
  } catch (error) {
    console.error("Failed to unblock API:", error);
  }
}

(async () => {
  const client = await Client.create(
    createSigner(WALLET_KEY),
    getEncryptionKeyFromHex(ENCRYPTION_KEY),
    { env: "dev" },
  );
  await client.conversations.sync();
  console.log(`Agent initialized on ${client.accountAddress}`);
  console.log(
    `Send a message on http://xmtp.chat/dm/${client.accountAddress}?env=dev`,
  );

  for await (const message of await client.conversations.streamAllMessages()) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    )
      continue;
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    console.log(`Sending "gm" response...`);
    await conversation?.send("gm");
  }
})().catch(console.error);
