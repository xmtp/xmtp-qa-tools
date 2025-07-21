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
  const MESSAGE_COUNT = parseInt(process.env.DELIVERY_AMOUNT ?? "100");
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

    // Use the working verifyMessageStream function instead of manual implementation
    console.log("=== USING VERIFY MESSAGE STREAM ===");
    const stats = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      MESSAGE_COUNT,
      "debug-{i}-{randomSuffix}", // Custom message template for debugging
    );

    console.log("=== RESULTS ===");
    console.log(
      `Reception percentage: ${stats.receptionPercentage.toFixed(1)}%`,
    );
    console.log(`Order percentage: ${stats.orderPercentage.toFixed(1)}%`);
    console.log(`Average timing: ${stats.averageEventTiming}ms`);
    console.log(`All received: ${stats.allReceived}`);
    console.log(`Almost all received: ${stats.almostAllReceived}`);
    console.log("=== DEBUG TEST END ===");

    // Use the same expectations as the working test
    expect(stats.orderPercentage).toBeGreaterThan(ERROR_TRESHOLD);
    expect(stats.receptionPercentage).toBeGreaterThan(ERROR_TRESHOLD);
  });
});
