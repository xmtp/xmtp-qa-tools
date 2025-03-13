import { loadEnv } from "@helpers/client";
import { type Client, type XmtpEnv } from "@helpers/types";
import { getWorkers } from "@workers/factory";

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
  const personas = await getWorkers(["bot"], testName, "none", true);

  const bot = personas.get("bot");
  const client = bot?.client as Client;

  const env = process.env.XMTP_ENV as XmtpEnv;
  console.log(`Agent initialized on address ${bot?.address}`);
  console.log(`Agent initialized on inbox ${client.inboxId}`);
  console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);
  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  try {
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      try {
        console.log("Message received:", message);
        /* Ignore messages from the same agent or non-text messages */
        if (
          message?.senderInboxId.toLowerCase() ===
            client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text" ||
          message?.content === "gm"
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
