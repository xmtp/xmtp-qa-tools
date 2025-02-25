import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
} from "../../helpers/client";

dotenv.config();
const { WALLET_KEY_BOT, ENCRYPTION_KEY_BOT, OPENAI_API_KEY } = process.env;

if (!WALLET_KEY_BOT) {
  throw new Error("WALLET_KEY_BOT must be set");
}

if (!ENCRYPTION_KEY_BOT) {
  throw new Error("ENCRYPTION_KEY_BOT must be set");
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const signer = createSigner(WALLET_KEY_BOT as `0x${string}`);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY_BOT);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const env: XmtpEnv = "dev";

async function main() {
  const clientAddress = await signer.getAddress();
  const dbPath = getDbPath("gpt", clientAddress, env);

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

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: message.content as string }],
        model: "gpt-3.5-turbo",
      });

      const response =
        completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that.";
      console.log(`Sending AI response: ${response}`);
      await conversation.send(response);
    } catch (error) {
      console.error("Error getting AI response:", error);
      await conversation.send(
        "Sorry, I encountered an error processing your message.",
      );
    }

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
