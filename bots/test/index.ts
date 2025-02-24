import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
} from "../../helpers/client";
import { defaultValues } from "../../helpers/workers/creator";

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
  const dbPath = getDbPath("bot", "test", defaultValues.version, env);
  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
    dbPath,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}?env=${env}`,
  );

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

    if (message.content === "/gm") {
      console.log(`Sending "gm" response...`);
      await conversation.send("gm");
    } else if (message.content === "/group") {
      console.log("Creating group...");
      const groupName = `gm-${new Date().toISOString().split("T")[0]}`;
      const group = await client.conversations.newGroup([], {
        groupName: groupName,
        groupDescription: groupName,
      });
      console.log("Group created", group.id);

      await group.addMembersByInboxId([message.senderInboxId]);
      await group.addSuperAdmin(message.senderInboxId);
      console.log(
        "Sender is superAdmin",
        group.isSuperAdmin(message.senderInboxId),
      );

      await group.send(groupName);

      await conversation.send(
        `Group created!\n- ID: ${group.id}\n- Group URL: https://xmtp.chat/conversations/${group.id}\n- Converse url - https://converse.xyz/group/${group.id}\n- Name: ${groupName}\n- Description: ${groupName}`,
      );
    } else {
      console.log("Unknown command, skipping");
    }

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
