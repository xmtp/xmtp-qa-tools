import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  ts_large_createGroup,
  TS_LARGE_TOTAL,
  TS_LARGE_WORKER_COUNT,
} from "./helpers";

const testName = "ts_large_messages";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.Message;
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
    it(`receiveLargeGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        newGroup = await ts_large_createGroup(workers, i, true);

        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getWorkers(),
          1,
          "gm",
          () => {
            start = performance.now();
          },
        );

        const streamTimeMs = performance.now() - start;
        console.log(
          `Message stream for ${i} participants took ${streamTimeMs.toFixed(2)}ms`,
        );

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          messageStreamTimeMs: streamTimeMs,
        };

        expect(verifyResult.allReceived).toBe(true);
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
