import { verifyConversationStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog, WORKER_COUNT } from "./helpers";

const testName = "large_conversations";
describe(testName, async () => {
  let workers = await getWorkers(WORKER_COUNT);

  const summaryMap: Record<number, any> = {};

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
  });

  // Dedicated 10-person group test (independent of batch configuration)
  it(`receiveNewConversation-10-baseline: should create 10 member group (baseline)`, async () => {
    // Use the dedicated conversation stream verification helper
    const verifyResult = await verifyConversationStream(
      workers.getCreator(),
      workers.getAllButCreator(),
    );

    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.almostAllReceived).toBe(true);

    // Save metrics with special key for baseline
    summaryMap[10] = {
      ...(summaryMap[10] ?? { groupSize: 10 }),
      conversationStreamTimeMs: verifyResult.averageEventTiming,
      isBaseline: true,
    };
  });

  // Batch-based tests (existing behavior)
  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    it(`receiveNewConversation-${i}: should create ${i} member group`, async () => {
      // Use the dedicated conversation stream verification helper
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);

      // Save metrics (merge with baseline if same size)
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        conversationStreamTimeMs: verifyResult.averageEventTiming,
      };
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
