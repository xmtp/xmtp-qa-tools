import { loadEnv } from "@helpers/client";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type NestedPersonas,
  type XmtpEnv,
} from "@helpers/types";
import { getWorkers } from "@workers/factory";
import { CommandHandler } from "./commands";

const testName = "test-bot";
loadEnv(testName);

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

async function main() {
  try {
    // First create the bot persona
    console.log("Initializing bot...");
    const botPersona = await getWorkers(["bot"], testName, "message");
    const bot = botPersona.get("bot");
    const client = bot?.client as Client;

    const env = process.env.XMTP_ENV as XmtpEnv;
    console.log(`Agent initialized on address ${bot?.address}`);
    console.log(`Agent initialized on inbox ${client.inboxId}`);
    console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);

    // Then create the dynamic workers
    console.log("Initializing worker personas...");
    const personas = await getWorkers(20, testName, "message", true);
    const commandHandler = new CommandHandler();

    console.log("Syncing conversations...");
    await client.conversations.sync();

    console.log("Waiting for messages...");
    try {
      const stream = client.conversations.streamAllMessages();
      for await (const message of await stream) {
        try {
          /* Ignore messages from the same agent or non-text messages */
          if (
            message?.senderInboxId.toLowerCase() ===
              client.inboxId.toLowerCase() ||
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
          await processCommand(
            message,
            conversation,
            client,
            commandHandler,
            personas,
          );

          console.log("Waiting for messages...");
        } catch (error) {
          console.error("Error processing message:", error);
          // Continue the loop despite errors
        }
      }
    } catch (error) {
      console.error("Error streaming messages:", error);
      // Add more detailed error logging
      console.error("Error details:", JSON.stringify(error, null, 2));
    }
  } catch (error) {
    console.error("Error during initialization:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Helper function to process incoming commands
async function processCommand(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
  commandHandler: CommandHandler,
  personas: NestedPersonas,
) {
  try {
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
        await commandHandler.create(message, client, args, personas);
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
        await commandHandler.members(message, client, personas);
        break;
      case "admins":
        await commandHandler.admins(message, client, personas);
        break;
      case "blast":
        await commandHandler.blast(message, client, args, personas);
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
        await commandHandler.workers(message, client, personas);
        break;
      case "leave":
        await commandHandler.leave(message, client);
        break;
      case "add":
        await commandHandler.add(message, client, args, personas);
        break;
      case "remove":
        await commandHandler.remove(message, client, args, personas);
        break;
      default:
        await conversation.send(
          `Unknown command: /${command}\nType /help to see available commands.`,
        );
        break;
    }
  } catch (error: any) {
    console.error("Error executing command:", error);
    try {
      await conversation.send(
        `Error executing command: ${error.message || "Unknown error"}`,
      );
    } catch (sendError) {
      console.error("Failed to send error message:", sendError);
    }
  }
}

// Run the bot
main().catch((error: unknown) => {
  console.error("Fatal error in main function:", error);
  console.error("Error details:", JSON.stringify(error, null, 2));
  process.exit(1); // Explicitly exit with error code
});
