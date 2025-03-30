import { closeEnv, loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "speed";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const targetUser = process.env.CB_USER;

  if (!targetUser) {
    throw new Error("TARGET_USER is not set");
  }

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should measure response time from app", async () => {
    // Initialize workers
    workers = await getWorkers(["alice"], testName, "none", false);
    const sender = workers.get("alice");

    if (!sender) {
      throw new Error("Sender worker not initialized");
    }

    // Start a new conversation with target user
    const conversation = await sender.client.conversations.newDm(targetUser);
    console.log(`Created conversation with ID: ${conversation?.id}`);

    // Prepare test message
    const testMessage = `Hello! Performance test at ${new Date().toISOString()}, Reply as fast as possible`;

    // Set up message listener to capture response
    let responseReceived = false;

    const messageStream = sender.client.conversations.streamAllMessages();

    // Send the test message
    console.log(`Sending message: "${testMessage}"`);
    await conversation?.send(testMessage);
    const startTime = Date.now();

    // Wait for response with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout waiting for response"));
      }, 30000); // 30 second timeout
    });

    const responsePromise = (async () => {
      for await (const message of await messageStream) {
        // Skip messages from self
        if (
          message?.senderInboxId?.toLowerCase() ===
          sender.client.inboxId?.toLowerCase()
        ) {
          continue;
        }

        // Check if this is a response in our conversation
        if (message?.conversationId === conversation?.id) {
          const responseTime = Date.now() - startTime;
          responseReceived = true;
          console.log(`Response received: "${message.content as string}"`);
          console.log(`Response time: ${responseTime}ms`);
          return responseTime;
        }
      }
    })();

    const responseTime = await Promise.race([responsePromise, timeoutPromise]);
    console.log(
      `Test completed successfully. Response time: ${String(responseTime)}ms`,
    );
  });
});
