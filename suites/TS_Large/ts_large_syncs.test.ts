import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  ts_large_createGroup,
  TS_LARGE_TOTAL,
  type SummaryEntry,
} from "./helpers";

const testName = "ts_large_syncs";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.None;
  let workers: WorkerManager;
  let start: number;

  let testStart: number;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    TS_LARGE_TOTAL / TS_LARGE_BATCH_SIZE,
    testName,
    steamsToTest,
  );

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

  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`verifySyncAll-${i}: should verify sync time for a single worker (cold start)`, async () => {
      try {
        await ts_large_createGroup(workers, i, true);
        // Select one worker per batch (round-robin)
        const allWorkers = workers.getWorkers();
        const workerIdx = (i / TS_LARGE_BATCH_SIZE - 1) % allWorkers.length;
        console.log("workerIdx", workerIdx);
        const worker = allWorkers[workerIdx];
        const syncStart = performance.now();
        await worker.client.conversations.syncAll();
        const syncTimeMs = performance.now() - syncStart;

        // Save metrics, including worker name/installationId
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          syncTimeMs,
          workerName: `${worker.name}-${worker.installationId}`,
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
