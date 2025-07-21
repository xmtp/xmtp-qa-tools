import { sleep } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
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
  const MESSAGE_COUNT = parseInt(process.env.DELIVERY_AMOUNT ?? "1000");
  const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "10");
  const workers = await getWorkers(WORKER_COUNT);
  const group = await workers.createGroupBetweenAll();

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
    console.log(`Average timing: ${stats.averageEventTiming}ms`);
    console.log(`All received: ${stats.allReceived}`);
    console.log(`Almost all received: ${stats.almostAllReceived}`);
    console.log("=== DEBUG TEST END ===");

    // Use the same expectations as the working test
    expect(stats.receptionPercentage).toBeGreaterThan(ERROR_TRESHOLD);
  });
});
