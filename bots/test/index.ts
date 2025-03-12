import { loadEnv } from "@helpers/client";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type NestedPersonas,
  type XmtpEnv,
} from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { CommandHandler } from "./commands";

const testName = "test-bot";
loadEnv(testName);

async function main() {
  // Get 20 dynamic workers
  let personas: NestedPersonas;
  personas = await getWorkers(20, testName, "message", true);
  const commandHandler = new CommandHandler(personas);

  const client = personas.get("bot")?.client as Client;

  const env = process.env.XMTP_ENV as XmtpEnv;
  console.log(`Agent initialized on address ${client.inboxId}`);
  console.log(`Agent initialized on inbox ${client.inboxId}`);
  console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);

  console.log("Syncing conversations...");
  await client.conversations.sync();

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

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // Parse the message content to extract command and arguments
    await processCommand(message, conversation, client, commandHandler);

    console.log("Waiting for messages...");
  }
}

// Helper function to process incoming commands
async function processCommand(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
  commandHandler: CommandHandler,
) {
  const messageContent = message.content as string;
  const trimmedContent = messageContent.trim();

  if (trimmedContent.toLowerCase() === "gm") {
    await commandHandler.gm(message, client);
    return;
  }
  // Check if the message is a command (starts with '/')
  if (!trimmedContent.startsWith("/")) {
    return; // Not a command, ignore
  }

  // Extract command name and arguments
  const parts = trimmedContent.substring(1).split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Execute the appropriate command handler
  switch (command) {
    case "help":
      await commandHandler.help(message, client);
      break;
    case "create":
      await commandHandler.create(message, client, args);
      break;
    case "block":
      await commandHandler.block(message, client, args);
      break;
    case "unblock":
      await commandHandler.unblock(message, client, args);
      break;
    case "rename":
      await commandHandler.rename(message, client, args);
      break;
    case "members":
      await commandHandler.members(message, client);
      break;
    case "admins":
      await commandHandler.admins(message, client);
      break;
    case "blast":
      await commandHandler.blast(message, client, args);
      break;
    case "groups":
      await commandHandler.groups(message, client);
      break;
    case "broadcast":
      await commandHandler.broadcast(client, args);
      break;
    case "info":
      await commandHandler.info(message, client);
      break;
    case "workers":
      await commandHandler.workers(message, client);
      break;
    case "leave":
      await commandHandler.leave(message, client);
      break;
    case "add":
      await commandHandler.add(message, client, args);
      break;
    case "remove":
      await commandHandler.remove(message, client, args);
      break;
    default:
      await conversation.send(
        `Unknown command: /${command}\nType /help to see available commands.`,
      );
      break;
  }
}

// Run the bot
main().catch(console.error);
