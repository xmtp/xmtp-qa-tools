import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import { saveLog, ts_large_createGroup } from "./helpers";

const testName = "ts_large_syncs";
loadEnv(testName);

describe(testName, async () => {
  const workersCount = parseInt(process.env.TS_LARGE_WORKER_COUNT ?? "5");
  const batchSize = parseInt(process.env.TS_LARGE_BATCH_SIZE ?? "50");
  const total = parseInt(process.env.TS_LARGE_TOTAL ?? "100");
  const steamsToTest = typeofStream.None;
  let workers: WorkerManager;
  let start: number;

  let testStart: number;

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
    it(`verifySyncAll-${i}: should verify all streams and measure sync time per worker`, async () => {
      try {
        await ts_large_createGroup(workers, i, true);
        const syncStart = performance.now();
        let tracAll = [];
        for (const worker of workers.getWorkers()) {
          await worker.client.conversations.syncAll();
          const syncTimeMs = performance.now() - syncStart;
          tracAll.push(syncTimeMs);
        }

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          syncTimeMs: tracAll.reduce((a, b) => a + b, 0) / tracAll.length,
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
