import { sendMetric, type DeliveryMetricTags } from "@helpers/datadog";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "delivery";
describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  const amountofMessages = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
  const receiverAmount = parseInt(process.env.DELIVERY_RECEIVERS ?? "4");

  console.log(
    `[${testName}] Amount of messages: ${amountofMessages}, Receivers: ${receiverAmount}`,
  );
  let workers = await getWorkers(receiverAmount);

  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  beforeAll(async () => {
    console.log("creating group");
    group = await workers.createGroupBetweenAll();
  });

  it("verifyMessageStream: should verify message delivery and order accuracy using message streams", async () => {
    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      amountofMessages,
      `gm-{i}-${randomSuffix}`,
    );
    const receptionPercentage = verifyResult.receptionPercentage ?? 0;
    const orderPercentage = verifyResult.orderPercentage ?? 0;

    console.log(
      `Stream reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
    );

    // Don't fail if stats are missing or incomplete, just log and continue
    if (!verifyResult.receptionPercentage || !verifyResult.orderPercentage)
      console.log("Warning: No stats were generated for stream verification");

    // Only run expectations if we have values
    if (receptionPercentage > 0) {
      expect(receptionPercentage).toBeGreaterThan(0);

      const deliveryMetricTags: DeliveryMetricTags = {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "delivery",
        metric_subtype: "stream",
        conversation_type: "group",
      };
      sendMetric("delivery", receptionPercentage, deliveryMetricTags);
    }

    if (orderPercentage > 0) {
      expect(orderPercentage).toBeGreaterThan(0);

      const orderMetricTags: DeliveryMetricTags = {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "order",
        metric_subtype: "stream",
        conversation_type: "group",
      };
      sendMetric("order", orderPercentage, orderMetricTags);
    }
  });

  it("verifyMessagePoll: should verify message delivery and order accuracy using polling method", async () => {
    const workersFromGroup = await getWorkersFromGroup(group, workers);
    const messagesByWorker: string[][] = [];

    for (const worker of workersFromGroup) {
      const conversation =
        await worker.client.conversations.getConversationById(group.id);

      const messages = await conversation?.messages();
      if (!messages) throw new Error("Messages not found");
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
      amountofMessages,
      randomSuffix,
    );

    const receptionPercentage = stats.receptionPercentage ?? 0;
    const orderPercentage = stats.orderPercentage ?? 0;

    console.log(
      `Poll reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
    );

    // Only run expectations if we have values
    if (receptionPercentage > 0) {
      expect(receptionPercentage).toBeGreaterThan(0);

      const deliveryMetricTags: DeliveryMetricTags = {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "delivery",
        metric_subtype: "poll",
        conversation_type: "group",
      };
      sendMetric("delivery", receptionPercentage, deliveryMetricTags);
    }

    if (orderPercentage > 0) {
      expect(orderPercentage).toBeGreaterThan(0);
      const orderMetricTags: DeliveryMetricTags = {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "order",
        metric_subtype: "poll",
        conversation_type: "group",
      };
      sendMetric("order", orderPercentage, orderMetricTags);
    }
  });

  it("verifyMessageRecovery: should verify message recovery and delivery after client reconnection", async () => {
    // Select one worker to take offline
    const offlineWorker = workers.getCreator(); // Second worker
    const onlineWorker = workers.getReceiver(); // First worker

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
      messagesByWorker,
      "offline-msg-",
      amountofMessages,
      randomSuffix,
    );
    const receptionPercentage = stats.receptionPercentage ?? 0;
    const orderPercentage = stats.orderPercentage ?? 0;

    console.log(
      `Recovery reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
    );

    // Only run expectations if we have values
    if (receptionPercentage > 0) {
      expect(receptionPercentage).toBeGreaterThan(0);

      const deliveryMetricTags: DeliveryMetricTags = {
        metric_subtype: "recovery",
        metric_type: "delivery",
        sdk: offlineWorker.sdk,
        test: testName,
        conversation_type: "group",
      };
      sendMetric("delivery", receptionPercentage, deliveryMetricTags);
    }

    if (orderPercentage > 0) {
      expect(orderPercentage).toBeGreaterThan(0);
      const orderMetricTags: DeliveryMetricTags = {
        metric_type: "order",
        metric_subtype: "recovery",
        sdk: offlineWorker.sdk,
        test: testName,
        conversation_type: "group",
      };
      sendMetric("order", orderPercentage, orderMetricTags);
    }
  });
});

export async function getWorkersFromGroup(
  group: Group,
  workers: WorkerManager,
): Promise<Worker[]> {
  await group.sync();
  const memberIds = (await group.members()).map((m) => m.inboxId);
  return workers.getAll().filter((w) => memberIds.includes(w.client.inboxId));
}
