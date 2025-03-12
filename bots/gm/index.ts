import { loadEnv } from "@helpers/client";
import { type Client, type XmtpEnv } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";

const testName = "test-bot";
loadEnv(testName);

async function main() {
  // Get 20 dynamic workers
  const personas = await getWorkers(["bot"], testName, "message", true);

  const bot = personas.get("bot");
  const client = bot?.client as Client;

  const env = process.env.XMTP_ENV as XmtpEnv;
  console.log(`Agent initialized on address ${bot?.address}`);
  console.log(`Agent initialized on inbox ${client.inboxId}`);
  console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);
  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();
  for await (const message of await stream) {
    console.log("Message received:", message);
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
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
    await conversation.send("gm");
    console.log("Waiting for messages...");
  }
}

// Run the bot
main().catch(console.error);
