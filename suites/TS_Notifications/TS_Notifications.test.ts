import { loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, it } from "vitest";

const testName = "ts_notifications";
loadEnv(testName);

// Helper function to wait for a specified delay
const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

describe(testName, () => {
  // Number of messages to send
  const NUM_MESSAGES = 10;
  // Test duration in milliseconds (30 seconds)
  const TEST_DURATION = 30 * 1000;
  // Interval between messages (TEST_DURATION / NUM_MESSAGES)
  const MESSAGE_INTERVAL = Math.floor(TEST_DURATION / NUM_MESSAGES);
  // Target worker (receiver)
  const receiverInboxId =
    "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b";
  // Sender workers
  const SENDER_WORKERS = ["alice", "bob", "sam", "walt", "tina"];

  let workers: WorkerManager;

  it(`should send ${NUM_MESSAGES} sequential messages to ${receiverInboxId} within ${TEST_DURATION / 1000} seconds`, async () => {
    try {
      // Initialize workers for senders and target
      workers = await getWorkers(SENDER_WORKERS, testName);

      console.log(
        `Starting notification test for ${TEST_DURATION / 1000} seconds...`,
      );

      // Function to send a message after delay
      const sendMessage = async (counter: number): Promise<void> => {
        try {
          // Calculate the delay based on counter
          const delay = (counter - 1) * MESSAGE_INTERVAL;

          // Get sender (can still be random or use a fixed one)
          const senderName =
            SENDER_WORKERS[Math.floor(Math.random() * SENDER_WORKERS.length)];

          // Create message content with counter
          const content = `${counter}/${NUM_MESSAGES}`;

          console.log(
            `Scheduling message ${counter}/${NUM_MESSAGES} from ${senderName} with delay of ${delay}ms`,
          );

          // Wait for the calculated delay
          await wait(delay);

          // Create DM conversation
          const client = workers.get(senderName)?.client;
          if (!client) {
            console.error(`Failed to get client for ${senderName}`);
            return;
          }

          const conversation =
            await client.conversations.newDm(receiverInboxId);

          if (!conversation) {
            console.error(`Failed to create conversation for ${senderName}`);
            return;
          }

          // Send the message after delay
          await conversation.send(content);
          console.log(
            `Sent message ${counter}/${NUM_MESSAGES} after ${delay}ms delay`,
          );
        } catch (error) {
          console.error(`Error sending message ${counter}:`, error);
        }
      };

      // Send messages sequentially
      for (let counter = 1; counter <= NUM_MESSAGES; counter++) {
        await sendMessage(counter);
      }

      console.log(
        `Test completed - all ${NUM_MESSAGES} messages have been sent in sequence`,
      );
    } catch (e: unknown) {
      console.error("Test error:", e);
      throw e;
    }
  });
});
