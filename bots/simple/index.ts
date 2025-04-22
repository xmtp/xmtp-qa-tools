import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";

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
  const workers = await getWorkers(["bob"], testName, "message", "gpt");
  const bot = workers.get("bob");
  const client = bot?.client as Client;
  console.log(`Agent initialized on address ${bot?.address}`);
  const env = process.env.XMTP_ENV as XmtpEnv;
  console.log(`https://xmtp.chat/dm/${bot?.address}?env=${env}`);

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  try {
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      try {
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
        console.log("conversation", conversation.id);
        console.log("message", message.senderInboxId);

        const inboxState = await client.preferences.inboxStateFromInboxIds([
          message.senderInboxId,
        ]);
        const addressFromInboxId = inboxState[0].identifiers[0].identifier;
        console.log(`Sending "gm" response to ${addressFromInboxId}...`);
        await conversation.send("address");
        await conversation.send(addressFromInboxId);
        await conversation.send("inboxId");
        await conversation.send(message.senderInboxId);
        await conversation.send("conversationId");
        await conversation.send(conversation.id);
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

main().catch(console.error);
