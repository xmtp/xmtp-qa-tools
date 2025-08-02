import {
  sendMetric,
  type DeliveryMetricTags,
  type ResponseMetricTags,
} from "@helpers/datadog";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "delivery";

describe(testName, async () => {
  setupTestLifecycle({
    testName,
    sendMetrics: true,
    sendDurationMetrics: false,
  });
  const ERROR_TRESHOLD = parseInt(process.env.ERROR_TRESHOLD ?? "90");
  const MESSAGE_COUNT = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
  const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
  const workers = await getWorkers(WORKER_COUNT);
  const group = await workers.createGroupBetweenAll();

  it("stream:message delivery and order accuracy using streams", async () => {
    const stats = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      MESSAGE_COUNT,
      undefined,
      60000, // 60s timeout
    );

    sendMetric("response", stats.averageEventTiming, {
      test: testName,
      metric_type: "stream",
      metric_subtype: "message",
      sdk: workers.getCreator().sdk,
    } as ResponseMetricTags);

    sendMetric("delivery", stats.receptionPercentage, {
      sdk: workers.getCreator().sdk,
      test: testName,
      metric_type: "delivery",
      metric_subtype: "stream",
      conversation_type: "group",
    } as DeliveryMetricTags);

    sendMetric("order", stats.orderPercentage, {
      sdk: workers.getCreator().sdk,
      test: testName,
      metric_type: "order",
      metric_subtype: "stream",
      conversation_type: "group",
    } as DeliveryMetricTags);

    if (stats.orderPercentage < 99) {
      console.error("orderPercentage", stats.orderPercentage);
    } else {
      console.log("orderPercentage", stats.orderPercentage);
    }

    if (stats.receptionPercentage < 99) {
      console.error("receptionPercentage", stats.receptionPercentage);
    } else {
      console.log("receptionPercentage", stats.receptionPercentage);
    }
    expect(stats.orderPercentage).toBeGreaterThan(ERROR_TRESHOLD);
    expect(stats.receptionPercentage).toBeGreaterThan(ERROR_TRESHOLD);
  });

  it("poll:message delivery and order accuracy using polling", async () => {
    // Send messages first
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    for (let i = 1; i <= MESSAGE_COUNT; i++) {
      await group.send(`poll-${i}-${randomSuffix}`);
    }

    // Poll messages from all receivers
    const messagesByWorker: string[][] = [];
    for (const worker of workers.getAllButCreator()) {
      const conversation =
        await worker.client.conversations.getConversationById(group.id);
      const messages = await conversation?.messages();

      const filteredMessages =
        messages
          ?.filter(
            (msg) =>
              msg.contentType?.typeId === "text" &&
              (msg.content as string).includes(`poll-`) &&
              (msg.content as string).includes(randomSuffix),
          )
          .map((msg) => msg.content as string) ?? [];

      messagesByWorker.push(filteredMessages);
    }

    const stats = calculateMessageStats(
      messagesByWorker,
      "poll-",
      MESSAGE_COUNT,
      randomSuffix,
    );

    sendMetric("delivery", stats.receptionPercentage, {
      sdk: workers.getCreator().sdk,
      test: testName,
      metric_type: "delivery",
      metric_subtype: "poll",
      conversation_type: "group",
    } as DeliveryMetricTags);

    sendMetric("order", stats.orderPercentage, {
      sdk: workers.getCreator().sdk,
      test: testName,
      metric_type: "order",
      metric_subtype: "poll",
      conversation_type: "group",
    } as DeliveryMetricTags);

    if (stats.orderPercentage < 99) {
      console.error("orderPercentage", stats.orderPercentage);
    } else {
      console.log("orderPercentage", stats.orderPercentage);
    }

    if (stats.receptionPercentage < 99) {
      console.error("receptionPercentage", stats.receptionPercentage);
    } else {
      console.log("receptionPercentage", stats.receptionPercentage);
    }
    expect(stats.orderPercentage).toBeGreaterThan(ERROR_TRESHOLD);
    expect(stats.receptionPercentage).toBeGreaterThan(ERROR_TRESHOLD);
  });

  it("recovery:message recovery after stream interruption", async () => {
    const offlineWorker = workers.getReceiver();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    console.log(`Stopping streams for ${offlineWorker.name}`);

    // Stop message streams for the worker
    offlineWorker.worker.endStream(typeofStream.Message);

    // Send messages while worker is offline
    console.log(`Sending ${MESSAGE_COUNT} messages while stream is stopped`);
    for (let i = 1; i <= MESSAGE_COUNT; i++) {
      await group.send(`recovery-${i}-${randomSuffix}`);
    }

    // Resume streams and sync
    console.log(`Resuming streams for ${offlineWorker.name}`);
    offlineWorker.worker.startStream(typeofStream.Message);

    // Sync conversations to catch up
    await offlineWorker.client.conversations.sync();
    const conversation =
      await offlineWorker.client.conversations.getConversationById(group.id);
    await conversation?.sync();

    // Check recovered messages
    const messages = await conversation?.messages();
    const recoveredMessages =
      messages
        ?.filter(
          (msg) =>
            msg.content &&
            typeof msg.content === "string" &&
            msg.content.includes(`recovery-`) &&
            msg.content.includes(randomSuffix),
        )
        .map((msg) => msg.content as string) ?? [];

    const stats = calculateMessageStats(
      [recoveredMessages],
      "recovery-",
      MESSAGE_COUNT,
      randomSuffix,
    );

    sendMetric("delivery", stats.receptionPercentage, {
      sdk: offlineWorker.sdk,
      test: testName,
      metric_type: "delivery",
      metric_subtype: "recovery",
      conversation_type: "group",
    } as DeliveryMetricTags);

    sendMetric("order", stats.orderPercentage, {
      sdk: offlineWorker.sdk,
      test: testName,
      metric_type: "order",
      metric_subtype: "recovery",
      conversation_type: "group",
    } as DeliveryMetricTags);

    if (stats.orderPercentage < 99) {
      console.error("orderPercentage", stats.orderPercentage);
    } else {
      console.log("orderPercentage", stats.orderPercentage);
    }

    if (stats.receptionPercentage < 99) {
      console.error("receptionPercentage", stats.receptionPercentage);
    } else {
      console.log("receptionPercentage", stats.receptionPercentage);
    }
    expect(stats.orderPercentage).toBeGreaterThan(ERROR_TRESHOLD);
    expect(stats.receptionPercentage).toBeGreaterThan(ERROR_TRESHOLD);
  });
});
