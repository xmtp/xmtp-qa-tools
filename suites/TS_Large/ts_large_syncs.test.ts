import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
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
    const allWorkers = workers.getWorkers();
    // Use different workers for each measurement
    const workerAIdx = (i / TS_LARGE_BATCH_SIZE - 1) % allWorkers.length;
    const workerBIdx = (workerAIdx + 1) % allWorkers.length;
    const workerCIdx = (workerAIdx + 2) % allWorkers.length;
    const workerDIdx = (workerAIdx + 3) % allWorkers.length;

    it(`newGroup-${i}: should verify new group time for a single worker (cold start)`, async () => {
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        console.log("Creator name: ", creator.name);
        const newGroup = await creator.client.conversations.newGroup(
          generatedInboxes.slice(0, i).map((inbox) => inbox.inboxId),
        );
        await newGroup.addMembers([allWorkers[workerAIdx].inboxId]);
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
        const workerA = allWorkers[workerAIdx];
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
        const workerB = allWorkers[workerBIdx];
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

    it(`cumulativeSyncAll-${i}: should measure syncAll for a different worker (cumulative)`, async () => {
      try {
        const workerC = allWorkers[workerCIdx];
        const cumulativeSyncAllStart = performance.now();
        await workerC.client.conversations.syncAll();
        const cumulativeSyncAllTimeMs =
          performance.now() - cumulativeSyncAllStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          cumulativeSyncAllTimeMs,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`cumulativeSync-${i}: should measure sync for a different worker (cumulative)`, async () => {
      try {
        const workerD = allWorkers[workerDIdx];
        const cumulativeSyncStart = performance.now();
        await workerD.client.conversations.sync();
        const cumulativeSyncTimeMs = performance.now() - cumulativeSyncStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          cumulativeSyncTimeMs,
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
