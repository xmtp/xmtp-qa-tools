import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "stitch";

describe(testName, () => {
  setupTestLifecycle({ testName });

  // Global variables to encapsulate shared state
  let workers: WorkerManager;
  let creator: Worker;
  let receiver: Worker;
  let dm: Dm; // The DM conversation

  it("setup", async () => {
    const messageTimeout = 5000; // 5 second timeout for message reception

    workers = await getWorkers(["randombob-a", "alice"]);
    creator = workers.get("randombob", "a")!;
    receiver = workers.get("alice")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    // Test first installation - should work
    const testMessage1 = "gm from installation A";

    // Start streaming messages on receiver
    await receiver.client.conversations.sync();
    const stream = receiver.client.conversations.streamAllMessages();

    let receivedMessages: any[] = [];
    const messagePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, messageTimeout);

      void stream.then(async (messageStream) => {
        for await (const message of messageStream) {
          if (
            message.conversationId === dm.id &&
            message.content === testMessage1
          ) {
            clearTimeout(timeout);
            receivedMessages.push(message);
            resolve(true);
            break;
          }
        }
      });
    });

    // Send message from first installation
    await dm.send(testMessage1);

    // Wait for message to be received
    const firstResult = await messagePromise;
    expect(firstResult).toBe(true);
    console.log("First installation test passed");

    // Create fresh second installation
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    // Test second installation - should fail
    const testMessage2 = "gm from installation B";

    // Start streaming for second test
    await receiver.client.conversations.sync();
    const stream2 = receiver.client.conversations.streamAllMessages();

    let receivedMessages2: any[] = [];
    const messagePromise2 = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, messageTimeout);

      void stream2.then(async (messageStream) => {
        for await (const message of messageStream) {
          if (
            message.conversationId === dm.id &&
            message.content === testMessage2
          ) {
            clearTimeout(timeout);
            receivedMessages2.push(message);
            resolve(true);
            break;
          }
        }
      });
    });

    // Send message from second installation
    await dm.send(testMessage2);

    // Wait for message - should timeout/fail
    const secondResult = await messagePromise2;

    // This should fail - the receiver won't get the message from the new installation
    expect(secondResult).toBe(true);
    console.log("Second installation test failed as expected (bug reproduced)");
  });
});
