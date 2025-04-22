import { loadEnv } from "@helpers/client";
import { handleStressCommand, TEST_CONFIGS } from "@helpers/stress";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { Dm, type Client } from "@xmtp/node-sdk";

const testName = "stress-bot";
loadEnv(testName);

let isStressTestRunning = false;
let workers: WorkerManager | undefined;

async function initializeBot() {
  const botWorker = await getWorkers(["bot"], testName, "none");
  const bot = botWorker.get("bot");
  console.log("Bot worker:", bot?.address);
  console.log("Bot worker client:", bot?.client.inboxId);
  return bot?.client as Client;
}

async function main() {
  try {
    const client = await initializeBot();
    await client.conversations.sync();
    const stream = client.conversations.streamAllMessages();

    for await (const message of await stream) {
      try {
        // Skip own messages and non-text messages
        if (
          message?.senderInboxId.toLowerCase() ===
            client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        )
          continue;

        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (!conversation) continue;

        // Only handle DM conversations
        if (!("peerInboxId" in conversation)) continue;

        isStressTestRunning = await handleStressCommand(
          message,
          conversation,
          client,
          isStressTestRunning,
        );
      } catch (error) {
        console.error("Error handling message:", error);
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
