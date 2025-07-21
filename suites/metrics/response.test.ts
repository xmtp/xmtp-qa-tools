import { sleep } from "@helpers/client";
import {
  sendMetric,
  type DeliveryMetricTags,
  type ResponseMetricTags,
} from "@helpers/datadog";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "delivery";

describe(testName, async () => {
  setupTestLifecycle({
    testName,
    sendMetrics: true,
    sendDurationMetrics: true,
  });
  const ERROR_TRESHOLD = parseInt(process.env.ERROR_TRESHOLD ?? "90");
  const MESSAGE_COUNT = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
  const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
  const workers = await getWorkers(WORKER_COUNT);
  const group = await workers.createGroupBetweenAll();

  it("stream: should verify message delivery and order accuracy using streams", async () => {
    await sleep(2000);
    const stats = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      MESSAGE_COUNT,
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

  // Debug version with slower message sending and more detailed logging
  it("debug: should verify message delivery with debugging", async () => {
    console.log("=== DEBUG TEST START ===");
    console.log(`Expected messages: ${MESSAGE_COUNT}`);
    console.log(`Workers: ${WORKER_COUNT}`);
    console.log(`Receivers: ${workers.getAllButCreator().length}`);

    await sleep(2000);

    // Start streams manually with logging
    workers.getAllButCreator().forEach((worker) => {
      console.log(`Starting message stream for ${worker.name}`);
      worker.worker.startStream(typeofStream.Message);
    });

    await sleep(1000); // Wait for streams to start

    // Start collectors BEFORE sending messages
    console.log("=== STARTING COLLECTORS ===");
    const collectPromises = workers.getAllButCreator().map(async (worker) => {
      console.log(`Starting collector for ${worker.name}`);
      return worker.worker.collectMessages(
        group.id,
        MESSAGE_COUNT,
        ["text"],
        30000, // 30s timeout
      );
    });

    await sleep(1000); // Wait for collectors to be ready

    // Send messages with delays
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const sentMessages: { content: string; sentAt: number }[] = [];

    console.log("=== SENDING MESSAGES ===");
    for (let i = 0; i < MESSAGE_COUNT; i++) {
      const content = `debug-${i + 1}-${randomSuffix}`;
      const sentAt = Date.now();

      console.log(`Sending message ${i + 1}/${MESSAGE_COUNT}: ${content}`);
      await group.send(content);
      sentMessages.push({ content, sentAt });

      // Add delay between messages to prevent overwhelming
      if (i < MESSAGE_COUNT - 1) {
        await sleep(100); // 100ms delay between messages
      }
    }

    console.log(`=== COLLECTING MESSAGES ===`);
    console.log(`Sent ${sentMessages.length} messages`);

    // Wait for all collectors to finish
    const allReceived = await Promise.all(collectPromises);

    console.log("=== RESULTS ===");
    allReceived.forEach((messages, idx) => {
      const worker = workers.getAllButCreator()[idx];
      console.log(
        `${worker.name}: ${messages.length}/${MESSAGE_COUNT} messages`,
      );
      if (messages.length < MESSAGE_COUNT) {
        console.log(`  Missing messages for ${worker.name}`);
        const receivedContents = messages.map((m) => m.message.content);
        const expectedContents = sentMessages.map((m) => m.content);
        const missing = expectedContents.filter(
          (expected) => !receivedContents.includes(expected),
        );
        console.log(
          `  Missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
        );
      }
    });

    const totalReceived = allReceived.reduce(
      (sum, msgs) => sum + msgs.length,
      0,
    );
    const expectedTotal = MESSAGE_COUNT * workers.getAllButCreator().length;
    const receptionPercentage = (totalReceived / expectedTotal) * 100;

    console.log(
      `Total received: ${totalReceived}/${expectedTotal} (${receptionPercentage.toFixed(1)}%)`,
    );
    console.log("=== DEBUG TEST END ===");

    // Don't fail the test, just log the results
    expect(receptionPercentage).toBeGreaterThan(0); // At least some messages should be received
  });
});
