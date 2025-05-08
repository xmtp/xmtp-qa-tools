import { loadEnv } from "@helpers/client";
import { getWorkersFromGroup } from "@helpers/groups";
import { verifyMessageStream, type VerifyStreamResult } from "@helpers/streams";
import { calculateMessageStats } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "order";
loadEnv(testName);

describe(testName, async () => {
  const amount = 5; // Number of messages to collect per receiver
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
  workers = await getWorkers(
    ["bob", "alice", "joe", "sam", "charlie"],
    testName,
  );
  let group: Group;
  let collectedMessages: VerifyStreamResult;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  it("stream: send the stream", async () => {
    // Create a new group conversation with Bob (creator), Joe, Alice, Charlie, Dan, Eva, Frank, Grace, Henry, Ivy, and Sam.
    group = await workers
      .get("bob")!
      .client.conversations.newGroup(
        workers.getWorkers().map((p) => p.client.inboxId),
      );
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();

    // Collect messages by setting up listeners before sending and then sending known messages.
    collectedMessages = await verifyMessageStream(
      group,
      workers.getWorkers(),
      amount,
      (i) => `gm-${i + 1}-${randomSuffix}`,
      undefined,
      () => {
        console.log("Message sent, starting timer now");
        start = performance.now();
      },
    );
    console.log("allReceived", collectedMessages.allReceived);
    expect(collectedMessages.allReceived).toBe(true);
  });

  it("stream_order: verify message order when receiving via streams", () => {
    // Group messages by worker
    const messagesByWorker: string[][] = [];

    // Normalize the collectedMessages structure to match the pull test
    for (let i = 0; i < collectedMessages.messages.length; i++) {
      messagesByWorker.push(collectedMessages.messages[i]);
    }

    const stats = calculateMessageStats(
      messagesByWorker,
      "gm-",
      amount,
      randomSuffix,
    );

    console.log(JSON.stringify(stats));
    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);
  });

  it("poll: should verify message order when receiving via pull", async () => {
    group = await workers
      .get("bob")!
      .client.conversations.newGroup([
        workers.get("joe")!.client.inboxId,
        workers.get("bob")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
        workers.get("sam")!.client.inboxId,
      ]);

    const messages: string[] = [];
    for (let i = 0; i < amount; i++) {
      messages.push("gm-" + (i + 1).toString() + "-" + randomSuffix);
    }

    // Send messages sequentially to maintain order
    for (const msg of messages) {
      await group.send(msg);
    }
  });

  it("poll_order: verify message order when receiving via pull", async () => {
    const workersFromGroup = await getWorkersFromGroup(group, workers);
    const messagesByWorker: string[][] = [];

    for (const worker of workersFromGroup) {
      const conversation =
        await worker.client.conversations.getConversationById(group.id);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      const messages = await conversation.messages();
      const filteredMessages: string[] = [];

      for (const message of messages) {
        if (
          message.contentType?.typeId === "text" &&
          (message.content as string).includes(randomSuffix)
        ) {
          filteredMessages.push(message.content as string);
        }
      }

      messagesByWorker.push(filteredMessages);
    }

    const stats = calculateMessageStats(
      messagesByWorker,
      "gm-",
      amount,
      randomSuffix,
    );

    console.log(JSON.stringify(stats));
    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);
  });
});
