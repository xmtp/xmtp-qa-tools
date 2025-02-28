import { createLogger, overrideConsole } from "@helpers/logger";
import { getWorkers } from "@helpers/workers/factory";
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { type Persona } from "../../helpers/types";

dotenv.config();

let personas: Record<string, Persona> = {};
const env: XmtpEnv = "dev";
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

  console.log(`Agent initialized on ${client.accountAddress}`);
  console.log(`https://xmtp.chat/dm/${client.accountAddress}?env=${env}`);

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
      const group = await client.conversations.newGroupByInboxIds(
        [
          personas.alice.client?.inboxId as string,
          personas.joe.client?.inboxId as string,
          personas.sam.client?.inboxId as string,
          message.senderInboxId,
        ],
        {
          groupName: groupName,
          groupDescription: groupName,
        },
      );
      console.log(
        `Group created with name ${groupName} by ${message.senderInboxId}`,
      );
      // Send random messages from each client in the group
      await group.send(groupName);

      const randomMessages = [
        "Hello everyone!",
        "Thanks for adding me to this group",
        "What's everyone working on today?",
        "Excited to be here!",
        "gm to the group",
      ];

      // Send messages from each persona
      if (personas.alice.client) {
        const aliceMessage =
          randomMessages[Math.floor(Math.random() * randomMessages.length)];
        await group.send(`Alice says: ${aliceMessage}`);
      }

      if (personas.joe.client) {
        const joeMessage =
          randomMessages[Math.floor(Math.random() * randomMessages.length)];
        await group.send(`Joe says: ${joeMessage}`);
      }

      if (personas.sam.client) {
        const samMessage =
          randomMessages[Math.floor(Math.random() * randomMessages.length)];
        await group.send(`Sam says: ${samMessage}`);
      }

      // Send a message as the bot
      await group.send("Bot says: Group chat initialized. Welcome everyone!");

      // await conversation.send(
      //   `Group created!\n- ID: ${group.id}\n- Group URL: https://xmtp.chat/conversations/${group.id}\n- Converse url - https://converse.xyz/group/${group.id}\n- Name: ${groupName}\ne}`,
      // );
      await conversation.send(
        `Group created!\n- ID: ${group.id} - Name: ${groupName}`,
      );
      continue;
    }

    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}
main().catch(console.error);
