import { loadEnv } from "@helpers/client";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type WorkerManager,
  type XmtpEnv,
} from "@helpers/types";
import { getWorkers } from "@workers/manager";

const testName = "stress-bot";
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
    // First create the bot worker

    // Then create the dynamic workers
    console.log("Initializing worker workers...");
    const workers = await getWorkers(20, testName, "message", true);
    const botWorker = await getWorkers(["bot"], testName, "none", false);
    const bot = botWorker.get("bot");
    const client = bot?.client as Client;

    const env = process.env.XMTP_ENV as XmtpEnv;
    console.log(`Agent initialized on address ${bot?.address}`);
    console.log(`Agent initialized on inbox ${client.inboxId}`);
    console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);
    console.log("Syncing conversations...");
    await client.conversations.sync();

    //await sendInitialTestMessage(client);
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

          const conversation = await client.conversations.getConversationById(
            message.conversationId,
          );

          if (!conversation) {
            console.log("Unable to find conversation, skipping");
            continue;
          }
          console.log(
            `Received message: ${message.content as string} by ${message.senderInboxId}`,
          );

          // Parse the message content to extract command and arguments
          await processCommand(message, conversation, client, workers);

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

async function sendInitialTestMessage(client: Client) {
  // Send dm to the bot
  const cbUser = process.env.CB_USER;
  if (!cbUser) {
    throw new Error("CB_USER is not set");
  }
  const dm = await client.conversations.newDm(cbUser);
  await dm.send("gm from bot");
  console.log("DM sent:", dm.id);
}

// Helper function to process incoming commands
async function processCommand(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
  workers: WorkerManager,
) {
  try {
    const messageContent = message.content as string;
    const trimmedContent = messageContent.trim();

    // Extract command name and arguments
    const parts = trimmedContent.substring(1).split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Execute the appropriate command handler
    switch (command) {
      case "blast":
        await blast(message, client, args, workers);
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

async function blast(
  message: DecodedMessage,
  client: Client,
  args: string[] = [],
  workers: WorkerManager,
) {
  try {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    // Extract the message and optional count parameters
    // Format: /blast <message> <count> <repeat>
    // Example: /blast jaja 5 5 - sends "jaja" to 5 workers, 5 times each

    // Get the message from all arguments
    let blastMessage = args.join(" ").trim();

    // Default values
    let countOfWorkers = 5; // Number of workers to message
    let repeatCount = 1; // Number of times to send the message

    // Check if the last two arguments are numbers
    const lastArg = args[args.length - 1];
    const secondLastArg = args[args.length - 2];

    if (
      lastArg &&
      !isNaN(parseInt(lastArg)) &&
      secondLastArg &&
      !isNaN(parseInt(secondLastArg))
    ) {
      repeatCount = parseInt(lastArg);
      countOfWorkers = parseInt(secondLastArg);
      // Remove the numbers from the message
      const messageWords = blastMessage.split(" ");
      blastMessage = messageWords.slice(0, messageWords.length - 2).join(" ");
    }

    await conversation?.send(`🔊 Blasting message: ${blastMessage}`);
    for (let i = 0; i < repeatCount; i++) {
      for (const worker of workers.getWorkers().slice(0, countOfWorkers)) {
        const workerGroup = await worker.client?.conversations.newDm(
          message.senderInboxId,
        );
        await workerGroup?.send(`${worker.name}:\n${blastMessage} ${i}`);
      }
      await conversation?.send(`🔊 Round ${i + 1} of ${repeatCount} done`);
    }
    await conversation?.send(
      `🔊 You received ${countOfWorkers * repeatCount} messages`,
    );
  } catch (error) {
    console.error("Error blasting:", error);
  }
}

// Run the bot
main().catch((error: unknown) => {
  console.error("Fatal error in main function:", error);
  console.error("Error details:", JSON.stringify(error, null, 2));
  process.exit(1); // Explicitly exit with error code
});
