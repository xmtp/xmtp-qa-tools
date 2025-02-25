import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
} from "../../helpers/client";

dotenv.config();

const { WALLET_KEY_BOT, ENCRYPTION_KEY_BOT } = process.env;

if (!WALLET_KEY_BOT) {
  throw new Error("WALLET_KEY_BOT must be set");
}

if (!ENCRYPTION_KEY_BOT) {
  throw new Error("ENCRYPTION_KEY_BOT must be set");
}

const signer = createSigner(WALLET_KEY_BOT as `0x${string}`);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY_BOT);

const env: XmtpEnv = "dev";

async function main() {
  const clientAddress = await signer.getAddress();
  const dbPath = getDbPath("gated-group", clientAddress, env);

  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
    dbPath,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(`Agent initialized on`, {
    inboxId: client.inboxId,
    accountAddress: client.accountAddress,
    deeplink: `https://xmtp.chat/dm/${client.accountAddress}?env=${env}`,
  });

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    // Ignore own messages
    if (message.senderInboxId === client.inboxId) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    console.log(`Sending "gm" response...`);
    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
