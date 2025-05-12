import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  TS_LARGE_TOTAL,
  type SummaryEntry,
} from "./helpers";

const testName = "ts_large_cumulative_syncs";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.None;
  let workers: WorkerManager;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames((TS_LARGE_TOTAL / TS_LARGE_BATCH_SIZE) * 2 + 1),
    testName,
    steamsToTest,
  );
  let allWorkers: Worker[];
  // Use different workers for each measurement
  allWorkers = workers.getAllButCreator();

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    expect,
    workers,
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration,
  });

  let run = 0;
  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`newGroup-${i}: should verify new group time for a single worker (cold start)`, async () => {
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        console.log("Creator name: ", creator.name);
        const newGroup = await creator.client.conversations.newGroup(
          generatedInboxes.slice(0, i).map((inbox) => inbox.inboxId),
        );
        await newGroup.addMembers(allWorkers.map((worker) => worker.inboxId));
        const createTimeMs = performance.now() - createTime;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          createTimeMs,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`singleSyncAll-${i}: should measure syncAll for a single worker (cold start)`, async () => {
      try {
        const syncAllStart = performance.now();
        await allWorkers[run].client.conversations.syncAll();
        const singleSyncAllTimeMs = performance.now() - syncAllStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          singleSyncAllTimeMs,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`singleSync-${i}: should measure sync for a different worker (cold start)`, async () => {
      try {
        const syncStart = performance.now();
        await allWorkers[run + 1].client.conversations.sync();
        const singleSyncTimeMs = performance.now() - syncStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          singleSyncTimeMs,
        };
        run += 2;
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  afterAll(() => {
    saveLog(summaryMap);
  });
});
