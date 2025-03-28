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

async function main() {
  try {
    const botWorker = await getWorkers(["bot"], testName, "none", false);
    const bot = botWorker.get("bot");
    const client = bot?.client as Client;

    const env = process.env.XMTP_ENV as XmtpEnv;
    console.log(`Agent initialized on address ${bot?.address}`);
    console.log(`Agent initialized on inbox ${client.inboxId}`);
    console.log(`https://xmtp.chat/dm/${client.inboxId}?env=${env}`);

    await client.conversations.sync();
    console.log("Waiting for messages...");

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

        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (!conversation) {
          console.log("Unable to find conversation, skipping");
          continue;
        }

        const messageContent = message.content as string;
        if (messageContent.toLowerCase().startsWith("/stress")) {
          await handleStressTest(message, conversation, client);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

async function handleStressTest(
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
) {
  try {
    const args = (message.content as string).split(" ");
    let messageCount = 10; // Default value
    let workers: WorkerManager | null = null;

    // Add reset command
    if (args[1]?.toLowerCase() === "reset") {
      await conversation.send("🔄 Resetting stress test workers...");
      try {
        // Terminate all workers if they exist
        if (workers) {
          await workers.terminateAll();
        }
        await conversation.send(
          "✅ All workers terminated successfully.\n" +
            "Type /stress to start a new test.",
        );
        return;
      } catch (error) {
        await conversation.send(
          "❌ Error terminating workers: " +
            (error instanceof Error ? error.message : String(error)),
        );
        return;
      }
    }

    // If no arguments provided, show help including reset command
    if (args.length === 1) {
      await conversation.send(
        "🤖 Welcome to the XMTP Stress Test!\n\n" +
          "Available commands:\n" +
          "- /stress <number> - Start test with specified number of workers\n" +
          "- /stress reset - Terminate all workers and start over\n\n" +
          "Please specify how many workers you'd like to use (1-100).\n" +
          "Reply with a number to continue.",
      );
      return;
    }

    // If first argument is a number, it's the worker count
    if (!isNaN(parseInt(args[1]))) {
      const requestedWorkers = parseInt(args[1]);

      // Validate worker count
      if (requestedWorkers < 1 || requestedWorkers > 100) {
        await conversation.send(
          "⚠️ Please specify a valid number of workers between 1 and 100.",
        );
        return;
      }

      // Ask for message count
      if (args.length === 2) {
        await conversation.send(
          `👥 You've requested ${requestedWorkers} workers.\n\n` +
            "How many messages should each worker send?\n" +
            "Reply with: /stress " +
            String(requestedWorkers) +
            " <number_of_messages> (default is 10)",
        );
        return;
      }

      const messageCount = parseInt(args[2]);
      if (isNaN(messageCount) || messageCount < 1) {
        await conversation.send(
          "⚠️ Please specify a valid number of messages per worker.",
        );
        return;
      }

      // Show confirmation with details
      const totalMessages = requestedWorkers * messageCount * 2; // *2 for DM and group
      await conversation.send(
        "📋 Stress Test Configuration:\n\n" +
          `- Number of workers: ${requestedWorkers}\n` +
          `- Messages per worker: ${messageCount}\n` +
          `- Total messages to be sent: ${totalMessages}\n` +
          `  (${messageCount} DMs + ${messageCount} group messages) × ${requestedWorkers} workers\n\n` +
          "⚠️ This will create a new group and send multiple messages.\n\n" +
          "Reply with '/stress confirm' to start the test.",
      );
      return;
    }

    // Handle confirmation
    if (args[1].toLowerCase() === "confirm") {
      // Initialize workers only when confirming the test
      const requestedWorkers = parseInt(args[0].split(" ")[1]);
      workers = await getWorkers(requestedWorkers, testName, "message", true);

      const workerInboxIds = workers
        .getWorkers()
        .map((w) => w.client?.inboxId)
        .filter(Boolean);

      await conversation.send("🚀 Initializing stress test...");

      // Create group with all participants
      const memberInboxIds = [
        ...workerInboxIds,
        message.senderInboxId,
        client.inboxId,
      ];

      const group = await client.conversations.newGroup(memberInboxIds, {
        groupName: `Stress Test Group ${Date.now()}`,
        groupDescription: "Group for stress testing",
      });

      await conversation.send(
        "📊 Progress:\n1. ✅ Created test group\n2. ⏳ Starting message tests...",
      );

      // Send DM messages
      for (const worker of workers.getWorkers()) {
        const dm = await worker.client?.conversations.newDm(
          message.senderInboxId,
        );
        const groupFromWorker =
          await worker.client?.conversations.getConversationById(group.id);
        for (let i = 0; i < messageCount; i++) {
          await dm?.send(
            `DM Stress Test from ${worker.name} - Message ${i + 1}/${messageCount}`,
          );
          await groupFromWorker?.send(
            `Group Stress Test from ${worker.name} - Message ${i + 1}/${messageCount}`,
          );
        }
      }

      const totalMessages = workers.getWorkers().length * messageCount * 2;
      await conversation.send(
        `✅ Stress test completed!\n` +
          `Total messages sent: ${totalMessages}\n` +
          `- ${messageCount} DM messages from each worker\n` +
          `- ${messageCount} group messages from each worker\n` +
          `Total workers: ${workers.getWorkers().length}`,
      );
    }
  } catch (error) {
    console.error("Error in stress test:", error);
    await conversation.send(
      `❌ Error during stress test: ${error instanceof Error ? error.message : String(error)}\n` +
        "You can type '/stress reset' to terminate all workers and start over.",
    );
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
