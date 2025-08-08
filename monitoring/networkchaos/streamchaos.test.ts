import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const chaosLatencyMs = process.env.CHAOS_LATENCY_MS ? parseInt(process.env.CHAOS_LATENCY_MS) : 0;
const chaosJitterMs = process.env.CHAOS_JITTER_MS ? parseInt(process.env.CHAOS_JITTER_MS) : 0;
const chaosLossPct = process.env.CHAOS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_PACKET_LOSS_PCT) : 0;
const chaosEgressLatencyMs = process.env.CHAOS_EGRESS_LATENCY_MS ? parseInt(process.env.CHAOS_EGRESS_LATENCY_MS) : 0;
const chaosEgressJitterMs = process.env.CHAOS_EGRESS_JITTER_MS ? parseInt(process.env.CHAOS_EGRESS_JITTER_MS) : 0;
const chaosEgressLossPct = process.env.CHAOS_EGRESS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_EGRESS_PACKET_LOSS_PCT) : 0;

console.log("=== Delivery Chaos Test Configuration ===");
console.table({
  DURATION_MS: durationMs,
  CHAOS_LATENCY_MS: chaosLatencyMs,
  CHAOS_JITTER_MS: chaosJitterMs,
  CHAOS_PACKET_LOSS_PCT: chaosLossPct,
  CHAOS_EGRESS_LATENCY_MS: chaosEgressLatencyMs,
  CHAOS_EGRESS_JITTER_MS: chaosEgressJitterMs,
  CHAOS_EGRESS_PACKET_LOSS_PCT: chaosEgressLossPct,
  ENABLED_OPS: enabledOps.join(", ")
});
console.log("=======================================");

const testName = "delivery";

async function getWorkersFromNodeList(totalWorkers: number, nodeUrls: string[]) {
  const assignments: Record<string, string> = {};
  for (let i = 0; i < totalWorkers; i++) {
    const label = `user${i + 1}`;
    const nodeUrl = nodeUrls[i % nodeUrls.length];
    assignments[label] = nodeUrl;
  }
  return await getWorkers(assignments);
}

describe(testName, async () => {
  setupDurationTracking({
    testName,
    initDataDog: true,
    sendDurationMetrics: false,
  });
  const ERROR_TRESHOLD = parseInt(process.env.ERROR_TRESHOLD ?? "90");
  const MESSAGE_COUNT = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
  const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");

  const workers = await getWorkersFromNodeList(WORKER_COUNT, [
    "http://localhost:5556",
    "http://localhost:6556",
    "http://localhost:7556",
    "http://localhost:8556",
  ]);

  const group = await workers.createGroupBetweenAll();

  it("streamMessage:message delivery and order accuracy using streams", async () => {
    const stats = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      MESSAGE_COUNT,
      undefined,
      120 * 1000, // 120s timeout
    );

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
