import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_cumulative_syncs";

describe(testName, async () => {
  let workers: WorkerManager;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers((m_large_TOTAL / m_large_BATCH_SIZE) * 2 + 1);
  // Note: No streams needed for this test (was set to None)
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
    workers,
    getCustomDuration: () => customDuration,
    setCustomDuration,
  });

  let run = 0;
  for (
    let i = m_large_BATCH_SIZE;
    i <= m_large_TOTAL;
    i += m_large_BATCH_SIZE
  ) {
    it(`newGroup-${i}: should create ${i} member group and add all worker members`, async () => {
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        console.log("Creator name: ", creator.name);
        const newGroup = await creator.client.conversations.newGroup(
          getInboxIds(i),
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

    it(`syncAll-${i}: should measure cumulative syncAll performance impact on ${i}-member group with growing conversation history`, async () => {
      try {
        const syncAllStart = performance.now();
        await allWorkers[run].client.conversations.syncAll();
        const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          cumulativeSyncAllTimeMs,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`sync-${i}: should measure cumulative sync performance impact on ${i}-member group using different worker with accumulated data`, async () => {
      try {
        const syncStart = performance.now();
        await allWorkers[run + 1].client.conversations.sync();
        const cumulativeSyncTimeMs = performance.now() - syncStart;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          cumulativeSyncTimeMs,
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
