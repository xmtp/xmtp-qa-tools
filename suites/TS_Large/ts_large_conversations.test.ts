import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyAddMembersStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  ts_large_createGroup,
  TS_LARGE_TOTAL,
  TS_LARGE_WORKER_COUNT,
  type SummaryEntry,
} from "./helpers";

const testName = "ts_large_conversations";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.Conversation;
  let workers: WorkerManager;
  let start: number;

  let newGroup: Group;

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
    it(`receiveAddMember-${i}: should create a new conversation`, async () => {
      try {
        newGroup = await ts_large_createGroup(workers, i, false);
        // Use the dedicated conversation stream verification helper
        const verifyResult = await verifyAddMembersStream(
          newGroup,
          workers.getWorkers(),
        );

        start = verifyResult.averageEventTiming;
        expect(verifyResult.allReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          conversationStreamTimeMs: verifyResult.averageEventTiming,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
