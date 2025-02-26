import { createLogger, overrideConsole } from "@helpers/logger";
import { getWorkers } from "@helpers/workers/factory";
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { WorkerNames, type Persona } from "../../helpers/types";

dotenv.config();

const { WALLET_KEY_BOT, ENCRYPTION_KEY_BOT, XMTP_ENV } = process.env;

if (!WALLET_KEY_BOT) {
  throw new Error("WALLET_KEY_BOT must be set");
}

if (!ENCRYPTION_KEY_BOT) {
  throw new Error("ENCRYPTION_KEY_BOT must be set");
}

let personas: Record<string, Persona> = {};
const env: XmtpEnv = XMTP_ENV as XmtpEnv;
async function main() {
  const logger = await createLogger("test-bot");
  overrideConsole(logger);
  personas = await getWorkers(
    ["bob", "bot", "alice", "joe", "sam"],
    env,
    "test-bot",
  );

  const client = personas.bot.client as Client;

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

    if (message.content === "/group") {
      console.log("Creating group...");
      await conversation.send("hang tight, creating group...");
      const groupName = `group-${new Date().toISOString().split("T")[0]}`;
      const group = await client.conversations.newGroup(
        [
          personas.alice.client?.accountAddress as `0x${string}`,
          personas.joe.client?.accountAddress as `0x${string}`,
          personas.sam.client?.accountAddress as `0x${string}`,
        ],
        {
          groupName: groupName,
          groupDescription: groupName,
        },
      );
      console.log(
        `Group created with name ${groupName} by ${message.senderInboxId}`,
      );

      await group.send(groupName);

      await conversation.send(
        `Group created!\n- ID: ${group.id}\n- Group URL: https://xmtp.chat/conversations/${group.id}\n- Converse url - https://converse.xyz/group/${group.id}\n- Name: ${groupName}\n- Description: ${groupName}`,
      );
      continue;
    }

    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}
main().catch(console.error);
