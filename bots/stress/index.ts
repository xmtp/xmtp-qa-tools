import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  Dm,
  Group,
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";

const testName = "stress-bot";
loadEnv(testName);

// Constants
const HELP_TEXT = `Stress bot commands:
/stress <groups> <workers> <messages> - Start a stress test
/stress reset - Reset all workers

Examples:
/stress 3 5 10 - Create 3 groups with 5 workers sending 10 messages each

* It will also create 3 large groups with 50, 100 and 200 members`;

let isStressTestRunning = false;
let workers: WorkerManager | undefined;

interface StressTestConfig {
  groupCount: number;
  workerCount: number;
  messageCount: number;
}

async function initializeBot() {
  const botWorker = await getWorkers(["bot"], testName, "none");
  const bot = botWorker.get("bot");
  const client = bot?.client as Client;
  logAgentDetails(client);

  return client;
}

function parseStressCommand(args: string[]): StressTestConfig | null {
  if (args.length < 3) return null;

  const groupCount = parseInt(args[1]);
  const workerCount = parseInt(args[2]);
  let messageCount = 5; // Default to 5 messages if not specified

  if (isNaN(groupCount) || groupCount < 1 || groupCount > 10) return null;
  if (isNaN(workerCount) || workerCount < 1 || workerCount > 100) return null;

  if (args[3]) {
    const parsedMessageCount = parseInt(args[3]);
    if (!isNaN(parsedMessageCount) && parsedMessageCount > 0) {
      messageCount = parsedMessageCount;
    }
  }

  return { groupCount, workerCount, messageCount };
}

async function sendWorkerMessagesToGroup(
  workers: WorkerManager,
  groupId: string,
  messageCount: number,
): Promise<void> {
  for (const worker of workers.getWorkers()) {
    console.log(
      `Worker ${worker.name} sending ${messageCount} messages to group ${groupId}`,
    );
    await worker.client?.conversations.sync();
    let messagesSent = 0;
    const groupFromWorker =
      await worker.client?.conversations.getConversationById(groupId);

    for (let i = 0; i < messageCount; i++) {
      await groupFromWorker?.send(
        `Group Test ${worker.name} - ${i + 1}/${messageCount}`,
      );
      messagesSent++;
    }

    console.log(
      `Worker ${worker.name} sent ${messagesSent}/${messageCount} messages to group ${groupId}`,
    );
  }
}
async function createLargeGroup(
  workers: WorkerManager,
  memberCount: number,
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<string | undefined> {
  if (generatedInboxes.length < memberCount) {
    console.log(`Not enough inboxes for ${memberCount}-member group`);
    await conversation.send(
      `⚠️ Not enough inboxes for ${memberCount}-member group`,
    );
    return undefined;
  }

  await conversation.send(`⏳ Creating group with ${memberCount} members...`);

  const inboxes = generatedInboxes
    .slice(0, memberCount)
    .map((entry) => entry.inboxId);
  const workerInboxes = workers
    .getWorkers()
    .map((w) => w.client?.inboxId)
    .filter(Boolean);

  try {
    console.log(`Creating large group with ${memberCount} members`);

    // Create the group in batches if necessary to avoid timeout issues
    const maxMembersPerBatch = 50;
    let group;

    if (memberCount > maxMembersPerBatch) {
      // First create with a subset of members
      const initialMembers = [
        ...inboxes.slice(0, maxMembersPerBatch),
        message.senderInboxId,
      ];

      group = await client.conversations.newGroup(initialMembers, {
        groupName: `Large Group ${memberCount} - ${Date.now()}`,
        groupDescription: `Test group with ${memberCount} members`,
      });

      console.log(
        `Initial group created with ${maxMembersPerBatch} members. Adding remaining members in batches...`,
      );

      // Add remaining members in batches
      const remainingInboxes = inboxes.slice(maxMembersPerBatch);
      const workerInboxesToAdd = workerInboxes.filter(
        (id) => !initialMembers.includes(id),
      );
      const allRemainingInboxes = [...remainingInboxes, ...workerInboxesToAdd];

      for (let i = 0; i < allRemainingInboxes.length; i += maxMembersPerBatch) {
        const batch = allRemainingInboxes.slice(i, i + maxMembersPerBatch);
        console.log(
          `Adding batch of ${batch.length} members to large group...`,
        );
        await group.addMembers(batch);
        console.log(`Successfully added batch of ${batch.length} members`);
      }
    } else {
      // For smaller groups, create with all members at once
      group = await client.conversations.newGroup(
        [...inboxes, ...workerInboxes, message.senderInboxId],
        {
          groupName: `Large Group ${memberCount} - ${Date.now()}`,
          groupDescription: `Test group with ${memberCount} members`,
        },
      );
    }

    await conversation.send(
      `✅ Created group with ${memberCount} members, ID: ${group.id}`,
    );

    try {
      // Try to send one test message from each worker
      await sendWorkerMessagesToGroup(workers, group.id, 1);
    } catch (messagingError) {
      console.error(
        `Error sending test messages to large group: ${messagingError instanceof Error ? messagingError.message : String(messagingError)}`,
      );
      // Don't fail the entire process due to messaging errors
    }

    return group.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Error creating large group with ${memberCount} members: ${errorMessage}`,
    );
    await conversation.send(`❌ Error creating large group: ${errorMessage}`);
    return undefined;
  }
}

async function runStressTest(
  config: StressTestConfig,
  message: DecodedMessage,
  conversation: Conversation,
  client: Client,
) {
  const startTime = Date.now();
  isStressTestRunning = true;

  try {
    await conversation.send("🚀 Initializing workers...");

    workers = await getWorkers(config.workerCount, testName, "message", "gm");
    console.log(
      `Successfully initialized ${workers.getWorkers().length} workers`,
    );

    await conversation.send(
      `✅ Successfully initialized ${config.workerCount} workers\n` +
        `📝 Test configuration:\n` +
        `- Groups to create: ${config.groupCount}\n` +
        `- Workers per group: ${config.workerCount}\n` +
        `- Messages per worker: ${config.messageCount}\n` +
        `- Large groups to create: 50, 100, 200\n` +
        `Total expected messages: ${config.groupCount + 3 * config.workerCount * config.messageCount} `,
    );

    const workerInboxIds = workers
      .getWorkers()
      .map((w) => w.inboxId)
      .filter(Boolean);
    console.log(`Collected ${workerInboxIds.length} worker inbox IDs`);

    // Create custom groups based on the configuration
    const createdGroups: string[] = [];

    await conversation.send(`⏳ Creating ${config.groupCount} test groups...`);

    // Log the inboxes being used
    const inboxList = [...workerInboxIds, message.senderInboxId].join(", ");
    console.log(`Adding inboxes: ${inboxList}`);

    for (let i = 0; i < config.groupCount; i++) {
      try {
        await client.conversations.sync();
        const groupInboxIds = [...workerInboxIds];

        // Ensure sender is included
        if (!groupInboxIds.includes(message.senderInboxId)) {
          groupInboxIds.push(message.senderInboxId);
        }

        // Create group with proper error handling
        const group = await client.conversations.newGroup(groupInboxIds, {
          groupName: `Stress Test Group ${i + 1} - ${Date.now()}`,
          groupDescription: `Group ${i + 1} for stress testing`,
        });

        console.log(`Created test group ${i + 1} with ID: ${group.id}`);
        createdGroups.push(group.id);
        await group.sync();
        await conversation.send(`✅ Test group ${i + 1} created successfully`);
      } catch (groupError) {
        const errorMsg =
          groupError instanceof Error ? groupError.message : String(groupError);
        console.error(`Error creating group ${i + 1}: ${errorMsg}`);
        await conversation.send(
          `⚠️ Failed to create group ${i + 1}: ${errorMsg}`,
        );
        // Continue with next group creation instead of failing the entire test
        continue;
      }
    }

    const largeGroupSizes = [50, 100, 200];
    for (const size of largeGroupSizes) {
      try {
        await createLargeGroup(workers, size, client, conversation, message);
      } catch (largeGroupError) {
        const errorMsg =
          largeGroupError instanceof Error
            ? largeGroupError.message
            : String(largeGroupError);
        console.error(
          `Error creating large group with ${size} members: ${errorMsg}`,
        );
        await conversation.send(
          `⚠️ Failed to create large group with ${size} members: ${errorMsg}`,
        );
        // Continue with next size instead of failing the entire test
      }
    }

    console.log(`Created ${createdGroups.length} test groups`);
    await conversation.send(
      `✅ Created ${createdGroups.length}/${config.groupCount} groups successfully`,
    );

    // Send messages to all groups
    console.log("Starting message sending process...");
    let messagesSent = 0;
    const totalMessages =
      config.groupCount * config.workerCount * config.messageCount;

    for (const groupId of createdGroups) {
      try {
        await conversation.send(`📨 Sending messages to group ${groupId}...`);
        await sendWorkerMessagesToGroup(workers, groupId, config.messageCount);

        const groupMessages = config.workerCount * config.messageCount;
        messagesSent += groupMessages;

        console.log(`Sent ${groupMessages} messages to group ${groupId}`);
        await conversation.send(
          `✅ Sent ${groupMessages} messages to group ${groupId}`,
        );
      } catch (sendError) {
        const errorMsg =
          sendError instanceof Error ? sendError.message : String(sendError);
        console.error(
          `Error sending messages to group ${groupId}: ${errorMsg}`,
        );
        await conversation.send(
          `⚠️ Failed to send messages to group ${groupId}: ${errorMsg}`,
        );
        // Continue with next group instead of failing the entire test
      }
    }

    console.log(
      `Test completed. Total messages sent: ${messagesSent}/${totalMessages}`,
    );

    await conversation.send(
      `🎉 Test completed!\n\n` +
        `📊 Final Statistics:\n` +
        `- Total messages sent: ${messagesSent}\n` +
        `- Groups created: ${createdGroups.length}\n` +
        `- Workers used: ${config.workerCount}\n` +
        `- Messages per worker per group: ${config.messageCount}\n` +
        `- Test duration: ${Math.floor((Date.now() - startTime) / 1000)}s`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await conversation.send(
      `❌ Error during stress test:\n${errorMessage}\n\nUse /stress reset to try again.`,
    );
    console.error("Stress test error:", errorMessage);
  } finally {
    isStressTestRunning = false;
  }
}

async function handleMessage(
  message: DecodedMessage,
  conversation: Dm | Group,
  client: Client,
) {
  // Check if this is a DM or Group
  const isDM = conversation instanceof Dm;
  const isGroup = conversation instanceof Group;

  const content = message.content as string;
  console.log(`Processing message: "${content}" from ${message.senderInboxId}`);

  const args = content.split(" ");
  const command = args[0].toLowerCase();

  // For non-commands, only send help text in DMs
  if (!command.startsWith("/")) {
    if (isDM) {
      console.log("Sending help text for non-command message in DM");
      await conversation.send(HELP_TEXT);
    }
    return;
  }

  // Handle commands
  console.log(`Handling command: ${command}`);
  switch (command) {
    case "/help":
      // Only send help in DMs to avoid spam in groups
      if (isDM) {
        console.log("Sending help text");
        await conversation.send(HELP_TEXT);
      }
      break;

    case "/stress": {
      // Allow stress commands in both DMs and groups
      if (args[1]?.toLowerCase() === "reset") {
        console.log("Processing stress reset command");
        // Terminate all workers
        try {
          if (workers) {
            await conversation.send("🧹 Cleaning up - terminating workers...");
            await workers.terminateAll();
            await conversation.send("✨ All workers terminated successfully");
          }
        } catch (cleanupError) {
          console.error("Error terminating workers:", cleanupError);
          await conversation.send(
            "⚠️ Warning: Some workers may not have terminated properly",
          );
        }
        isStressTestRunning = false;
        await conversation.send("🔄 Reset complete. Type /help to start over.");
        return;
      }

      if (isStressTestRunning) {
        console.log("Stress test already in progress, rejecting new test");
        await conversation.send(
          "⚠️ A stress test is already running. Please either:\n" +
            "1. Wait for it to complete, or\n" +
            "2. Use `/stress reset` to force stop all tests",
        );
        return;
      }

      const config = parseStressCommand(args);
      if (config) {
        console.log(`Starting stress test with config:`, config);
        await runStressTest(config, message, conversation, client);
      } else {
        console.log("Invalid stress test command format");
        await conversation.send(
          "⚠️ Invalid command format. Use /stress <groups> <workers> <messages>",
        );
      }
      break;
    }

    default:
      // Only send unknown command help in DMs
      if (isDM) {
        console.log("Unknown command, sending help text");
        await conversation.send(HELP_TEXT);
      }
  }
}

async function main() {
  try {
    const client = await initializeBot();
    await client.conversations.sync();
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      try {
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

        // Process all messages, not just DMs
        await handleMessage(message, conversation, client);
      } catch (error) {
        console.error("Message handling error:", error);
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
