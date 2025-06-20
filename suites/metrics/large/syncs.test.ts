import { getFixedNames } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_syncs";

describe(testName, async () => {
  let workers: WorkerManager;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getFixedNames((m_large_TOTAL / m_large_BATCH_SIZE) * 2 + 1),
    testName,
    typeofStream.None,
  );
  let allWorkers: Worker[];
  // Use different workers for each measurement
  allWorkers = workers.getAllButCreator();

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    expect,
    getCustomDuration: () => customDuration,
    setCustomDuration,
  });
  let workerA: Worker;
  let workerB: Worker;
  let run = 0;
  for (
    let i = m_large_BATCH_SIZE;
    i <= m_large_TOTAL;
    i += m_large_BATCH_SIZE
  ) {
    it(`newGroup-${i}: should create new ${i}-member group and measure cold start group creation time including member additions`, async () => {
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        workerA = allWorkers[run];
        workerB = allWorkers[run + 1];
        console.log(
          JSON.stringify(
            {
              creator: creator.name,
              workerA: workerA.name,
              workerB: workerB.name,
            },
            null,
            2,
          ),
        );
        const newGroup = await creator.client.conversations.newGroup(
          getInboxIds(i),
        );
        await newGroup.addMembers([workerA.inboxId, workerB.inboxId]);
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

    it(`syncAll-${i}: should perform cold start syncAll operation on ${i}-member group and measure total synchronization time`, async () => {
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

    it(`sync-${i}: should perform cold start sync operation on ${i}-member group using different worker and measure sync time`, async () => {
      try {
        const syncStart = performance.now();
        await workerB.client.conversations.sync();
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
