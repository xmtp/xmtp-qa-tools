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

const testName = "ts_large_syncs";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.None;
  let workers: WorkerManager;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames(TS_LARGE_TOTAL / TS_LARGE_BATCH_SIZE),
    testName,
    steamsToTest,
  );
  let allWorkers: Worker[];
  let workerA: Worker;
  let workerB: Worker;

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

  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`newGroup-${i}: should verify new group time for a single worker (cold start)`, async () => {
      // Use different workers for each measurement
      allWorkers = workers.getAllButCreator();
      const workerAIdx = (i / TS_LARGE_BATCH_SIZE - 1) % allWorkers.length;
      const workerBIdx = (workerAIdx + 1) % allWorkers.length;
      workerA = allWorkers[workerAIdx];
      workerB = allWorkers[workerBIdx];
      console.log("workerAIdx", allWorkers[workerAIdx].name);
      console.log("workerBIdx", allWorkers[workerBIdx].name);
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        console.log("Creator name: ", creator.name);
        const newGroup = await creator.client.conversations.newGroup(
          generatedInboxes.slice(0, i).map((inbox) => inbox.inboxId),
        );
        await newGroup.addMembers([
          allWorkers[workerAIdx].inboxId,
          allWorkers[workerBIdx].inboxId,
        ]);
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
        await workerA.client.conversations.syncAll();
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
        await workerB.client.conversations.sync();
        const singleSyncTimeMs = performance.now() - syncStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          singleSyncTimeMs,
        };
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
