import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMetadataStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
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
  type SummaryEntry,
} from "./helpers";

const testName = "ts_large_metadata";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.GroupUpdated;
  let workers: WorkerManager;
  let start: number;

  let newGroup: Conversation;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames(TS_LARGE_WORKER_COUNT),
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
  });

  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`receiveGroupMetadata-${i}: should create a group and measure all streams`, async () => {
      try {
        newGroup = await ts_large_createGroup(workers, i, true);
        const verifyResult = await verifyMetadataStream(
          newGroup as Group,
          workers.getWorkers(),
          undefined,
        );

        start = verifyResult.averageEventTiming;
        expect(verifyResult.allReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          groupUpdatedStreamTimeMs: verifyResult.averageEventTiming,
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
