import { loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { getWorkersFromGroup } from "@helpers/groups";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "ts_delivery";
loadEnv(testName);

describe(testName, async () => {
  const amountofMessages = parseInt(
    process.env.CLI_DELIVERY_AMOUNT ?? process.env.DELIVERY_AMOUNT ?? "10",
  );
  const receiverAmount = parseInt(
    process.env.CLI_DELIVERY_RECEIVERS ?? process.env.DELIVERY_RECEIVERS ?? "4",
  );

  console.log(
    `[${testName}] Amount of messages: ${amountofMessages}, Receivers: ${receiverAmount}`,
  );
  let workers: WorkerManager;
  workers = await getWorkers(receiverAmount, testName, typeofStream.Message);
  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  let start: number;
  let testStart: number;

  beforeAll(async () => {
    console.log("creating group");
    group = await workers
      .get("bob")!
      .client.conversations.newGroup([
        ...workers.getWorkers().map((p) => p.client.inboxId),
      ]);
  });

  setupTestLifecycle({
    expect,
    workers,
    testName,

    getStart: () => start,
    setStart: (v: number) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v: number) => {
      testStart = v;
    },
  });

  it("stream_order: verify message order when receiving via streams", async () => {
    const verifyResult = await verifyMessageStream(
      group,
      workers.getWorkers(),
      amountofMessages,
      randomSuffix,
    );

    expect(verifyResult.stats?.receptionPercentage).toBeGreaterThan(95);
    expect(verifyResult.stats?.orderPercentage).toBeGreaterThan(95);

    sendDeliveryMetric(
      verifyResult.stats?.receptionPercentage ?? 0,
      workers.getWorkers()[1].sdkVersion,
      workers.getWorkers()[1].libXmtpVersion,
      testName,
      "stream",
      "delivery",
    );
    sendDeliveryMetric(
      verifyResult.stats?.orderPercentage ?? 0,
      workers.getWorkers()[1].sdkVersion,
      workers.getWorkers()[1].libXmtpVersion,
      testName,
      "stream",
      "order",
    );
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
      workers.getWorkers(),
      messagesByWorker,
      "gm-",
      amountofMessages,
      randomSuffix,
    );

    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);

    sendDeliveryMetric(
      stats.receptionPercentage,
      workers.getWorkers()[1].sdkVersion,
      workers.getWorkers()[1].libXmtpVersion,
      testName,
      "poll",
      "delivery",
    );
    sendDeliveryMetric(
      stats.orderPercentage,
      workers.getWorkers()[1].sdkVersion,
      workers.getWorkers()[1].libXmtpVersion,
      testName,
      "poll",
      "order",
    );
  });

  it("offline_recovery: verify message recovery after disconnection", async () => {
    // Select one worker to take offline
    const offlineWorker = workers.get("bob")!; // Second worker
    const onlineWorker = workers.get("alice")!; // First worker

    console.log(`Taking ${offlineWorker.name} offline`);

    // Disconnect the selected worker
    await offlineWorker.worker.terminate();

    // Send messages from an online worker
    const conversation =
      await onlineWorker.client.conversations.getConversationById(group.id);

    console.log(`Sending ${amountofMessages} messages while client is offline`);
    for (let i = 0; i < amountofMessages; i++) {
      const message = `offline-msg-${i + 1}-${randomSuffix}`;
      await conversation!.send(message);
    }
    console.log("Sent messages");

    // Reconnect the offline worker
    console.log(`Reconnecting ${offlineWorker.name}`);
    const { client } = await offlineWorker.worker.initialize();
    offlineWorker.client = client;
    await offlineWorker.client.conversations.sync();

    const recoveredConversation =
      await offlineWorker.client.conversations.getConversationById(group.id);
    await recoveredConversation?.sync();
    const messages = await recoveredConversation?.messages();

    const messagesByWorker: string[][] = [];
    const recoveredMessages: string[] = [];
    for (const message of messages ?? []) {
      if (
        message.content &&
        typeof message.content === "string" &&
        message.content.includes(`offline-msg-`) &&
        message.content.includes(randomSuffix)
      ) {
        recoveredMessages.push(message.content);
      }
    }

    messagesByWorker.push(recoveredMessages);

    const stats = calculateMessageStats(
      workers.getWorkers(),
      messagesByWorker,
      "offline-msg-",
      amountofMessages,
      randomSuffix,
    );

    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);

    sendDeliveryMetric(
      stats.receptionPercentage,
      offlineWorker.sdkVersion,
      offlineWorker.libXmtpVersion,
      testName,
      "recovery",
      "delivery",
    );
    sendDeliveryMetric(
      stats.orderPercentage,
      offlineWorker.sdkVersion,
      offlineWorker.libXmtpVersion,
      testName,
      "recovery",
      "order",
    );
  });
});
