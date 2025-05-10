import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { verifyGroupUpdateStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { saveLog, ts_large_createGroup } from "./helpers";

const testName = "ts_large_metadata";
loadEnv(testName);

describe(testName, async () => {
  const workersCount = parseInt(process.env.TS_LARGE_WORKER_COUNT ?? "5");
  const batchSize = parseInt(process.env.TS_LARGE_BATCH_SIZE ?? "50");
  const total = parseInt(process.env.TS_LARGE_TOTAL ?? "100");
  const steamsToTest = typeofStream.GroupUpdated;
  let workers: WorkerManager;
  let start: number;

  let testStart: number;
  let newGroup: Conversation;

  // Hold timing metrics per group size
  interface SummaryEntry {
    groupSize: number;
    messageStreamTimeMs?: number;
    groupUpdatedStreamTimeMs?: number;
    conversationStreamTimeMs?: number;
    syncTimeMs?: number;
    createTimeMs?: number;
  }

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(workersCount, testName, steamsToTest);

  setupTestLifecycle({
    expect,
    workers,
    testName,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    it(`verifyLargeGroupMetadataStream-${i}: should update group name`, async () => {
      try {
        newGroup = await ts_large_createGroup(workers, i, true);
        const verifyResult = await verifyGroupUpdateStream(
          newGroup as Group,
          workers.getWorkers(),
          1,
          undefined,
          () => {
            start = performance.now();
          },
        );

        const streamTimeMs = performance.now() - start;
        console.log(
          `Group metadata update stream for ${i} participants took ${streamTimeMs.toFixed(2)}ms`,
        );

        expect(verifyResult.allReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          groupUpdatedStreamTimeMs: streamTimeMs,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // Aft
  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
