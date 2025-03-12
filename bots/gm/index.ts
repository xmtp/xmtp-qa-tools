import { loadEnv } from "@helpers/client";
import { type Client, type NestedPersonas } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";

const testName = "test-bot";
loadEnv(testName);

async function main() {
  // Get 20 dynamic workers
  let personas: NestedPersonas;
  personas = await getWorkers(["bot"], testName, "message", true);

  const client = personas.get("bot")?.client as Client;

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
    await conversation.send("gm");
    console.log("Waiting for messages...");
  }
}

// Run the bot
main().catch(console.error);
