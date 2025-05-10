import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyGroupUpdateStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  ts_large_createGroup,
  TS_LARGE_TOTAL,
  TS_LARGE_WORKER_COUNT,
} from "./helpers";

const testName = "ts_large_metadata";
loadEnv(testName);

describe(testName, async () => {
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

  workers = await getWorkers(TS_LARGE_WORKER_COUNT, testName, steamsToTest);

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
    it(`verifyLargeGroupMetadataStream-${i}: should update group name`, async () => {
      try {
        newGroup = await ts_large_createGroup(workers, i, true);
        const verifyResult = await verifyGroupUpdateStream(
          newGroup as Group,
          workers.getWorkers(),
          1,
          undefined,
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
