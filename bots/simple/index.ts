import { logAgentDetails } from "@bots/client";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Client } from "@xmtp/node-sdk";
import { loadEnv } from "dev/helpers/client";

const testName = "bot_simple";
loadEnv(testName);
async function main() {
  // Get 20 dynamic workers
  const workers = await getWorkers(
    ["bot"],
    testName,
    typeofStream.Message,
    typeOfResponse.Gpt,
    typeOfSync.None,
    "production",
  );
  const bot = workers.get("bot");
  const client = bot?.client as Client;

  console.log("Syncing conversations...");
  await client.conversations.sync();
  void logAgentDetails(client);
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
        console.log("senderInboxId", message.senderInboxId);

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
  }
}

main().catch(console.error);
