import { loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, it } from "vitest";

const testName = "ts_notifications";
loadEnv(testName);

// Helper function to wait for a specified delay
const wait = (): Promise<void> => {
  // Random delay range in milliseconds (3-6 seconds)
  const MIN_DELAY = 3000;
  const MAX_DELAY = 6000;
  // Generate random delay between MIN_DELAY and MAX_DELAY
  const delay =
    Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

describe(testName, async () => {
  // Number of messages to send
  const NUM_MESSAGES = 10;
  let groupId = "4015e815f7369e06edb294c29b1d0694";
  // Target worker (receiver)
  const receiverInboxId = process.env.CONVOS_DEV_NOTIFS as string;
  // Sender workers
  const SENDER_WORKERS = ["alice", "bob", "sam", "walt", "tina"];

  let workers: WorkerManager;
  // Initialize workers for senders and target
  workers = await getWorkers(SENDER_WORKERS, testName);

  it(`should send ${NUM_MESSAGES} messages to ${receiverInboxId} with random delays between 3-6 seconds`, async () => {
    try {
      console.log(`Starting notification test with random delays...`);

      // Send messages sequentially
      for (let counter = 1; counter <= NUM_MESSAGES; counter++) {
        try {
          // Get random sender
          const senderName =
            SENDER_WORKERS[Math.floor(Math.random() * SENDER_WORKERS.length)];

          // Create message content with counter
          const content = `${counter}/${NUM_MESSAGES}`;

          // Wait for the random delay
          await wait();

          // Create DM conversation
          const client = workers.get(senderName)?.client;

          const conversation =
            await client?.conversations.newDm(receiverInboxId);

          if (!conversation) {
            console.error(`Failed to create conversation for ${senderName}`);
            return;
          }

          // Send the message
          await conversation.send(content);

          console.log(
            `Sent message ${counter}/${NUM_MESSAGES} from ${senderName}`,
          );
        } catch (error) {
          console.error(`Error sending message ${counter}:`, error);
        }
      }

      console.log(
        `Test completed - all ${NUM_MESSAGES} messages have been sent`,
      );
    } catch (e: unknown) {
      console.error("Test error:", e);
      throw e;
    }
  });

  it(`should send ${workers.getAllButCreator().length} messages to ${groupId} with random delays between 3-6 seconds`, async () => {
    try {
      if (!groupId) {
        const client = workers.getCreator()?.client;
        const group = await client?.conversations.newGroup([
          ...workers.getAllButCreator().map((w) => w.inboxId),
          receiverInboxId,
        ]);
        if (!group) {
          console.error(`Failed to create conversation for alice`);
          return;
        }
        groupId = group.id;
      }
      let counter = 0;
      for (const worker of workers.getAllButCreator()) {
        const client = worker.client;
        await client?.conversations.sync();
        const conversation =
          await client?.conversations.getConversationById(groupId);
        if (!conversation) {
          console.error(`Failed to create conversation for ${worker.name}`);
          return;
        }
        await conversation.send(
          `Hello ${counter}/${NUM_MESSAGES}, ${worker.name}!`,
        );
        counter++;
      }
    } catch (e: unknown) {
      console.error("Test error:", e);
      throw e;
    }
  });
});
