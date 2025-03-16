import { loadEnv } from "@helpers/client";
import { type Client } from "@helpers/types";
import { getWorkers } from "@workers/manager";

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
  // Get 20 dynamic workers
  const workers = await getWorkers(["bob"], testName, "message", true);
  const bot = workers.get("bob");
  const client = bot?.client as Client;
  console.log(`Agent initialized on address ${bot?.address}`);
  console.log(`Agent initialized on inbox ${client.inboxId}`);
  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  try {
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      try {
        console.log(message);
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
        await conversation.send("Your inboxId is: " + message.senderInboxId);
        await conversation.send("conversationId: " + conversation.id);
        await conversation.send("gm");
        console.log("Waiting for messages...");
      } catch (error) {
        console.error("Error sending message:", error);
        // Add more detailed error logging
        console.error("Error details:", JSON.stringify(error, null, 2));
      }
    }
  } catch (error) {
    console.error("Error streaming messages:", error);
    // Add more detailed error logging
    console.error("Error details:", JSON.stringify(error, null, 2));
  }
}

// Run the bot
main().catch((error: unknown) => {
  console.error("Fatal error in main function:", error);
  console.error("Error details:", JSON.stringify(error, null, 2));
  process.exit(1); // Explicitly exit with error code
});
