import "dotenv/config";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "../../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),
    loggingLevel: process.env.LOGGING_LEVEL as any,
  });
  logAgentDetails(client);

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${
        message.senderInboxId
      }`,
    );

    const conversation = await client.conversations.getConversationById(
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
