import { closeEnv, loadEnv } from "@helpers/client";
import {
  calculateMessageStats,
  getWorkersFromGroup,
  verifyStream,
  type VerifyStreamResult,
} from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "order";
loadEnv(testName);

const amount = 5; // Number of messages to collect per receiver
// 2 seconds per message, multiplied by the total number of participants

describe(testName, () => {
  let workers: WorkerManager;
  let group: Group;
  let collectedMessages: VerifyStreamResult;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  beforeAll(async () => {
    workers = await getWorkers(
      [
        "bob",
        "alice",
        "joe",
        "sam",
        "charlie",
        "dave",
        "eve",
        "frank",
        "grace",
        "henry",
        "ivy",
        "jack",
        "karen",
        "larry",
      ],
      testName,
    );
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("tc_stream: send the stream", async () => {
    // Create a new group conversation with Bob (creator), Joe, Alice, Charlie, Dan, Eva, Frank, Grace, Henry, Ivy, and Sam.
    group = await workers
      .get("bob")!
      .client.conversations.newGroup(
        workers.getWorkers().map((p) => p.client.inboxId),
      );
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();

    // Collect messages by setting up listeners before sending and then sending known messages.
    collectedMessages = await verifyStream(
      group,
      workers.getWorkers(),
      "text",
      amount,
      (index) => `gm-${index + 1}-${randomSuffix}`,
    );
    console.log("allReceived", collectedMessages.allReceived);
    expect(collectedMessages.allReceived).toBe(true);
  });

  it("tc_stream_order: verify message order when receiving via streams", () => {
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

    // We expect all messages to be received and in order
    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95); // At least some workers should have correct order
  });

  it("tc_poll: should verify message order when receiving via pull", async () => {
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

  it("tc_poll_order: verify message order when receiving via pull", async () => {
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

    // We expect all messages to be received and in order
    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95); // At least some workers should have correct order
  });
});
