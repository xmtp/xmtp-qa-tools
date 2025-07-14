import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog } from "./helpers";

const testName = "large_cumulative_syncs";
describe(testName, async () => {
  setupTestLifecycle({
    testName,
    metrics: true,
  });
  let workers: WorkerManager;

  const summaryMap: Record<number, any> = {};

  workers = await getWorkers((MAX_GROUP_SIZE / BATCH_SIZE) * 2 + 1);
  // Note: No streams needed for this test (was set to None)
  let allWorkers: Worker[];
  // Use different workers for each measurement
  allWorkers = workers.getAllButCreator();

  let run = 0;
  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    it(`newGroup-${i}: should create ${i} member group and add all worker members`, async () => {
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
    });

    it(`syncAll-${i}: should measure cumulative syncAll performance impact on ${i}-member group with growing conversation history`, async () => {
      const syncAllStart = performance.now();
      await allWorkers[run].client.conversations.syncAll();
      const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        cumulativeSyncAllTimeMs,
      };
    });

    it(`sync-${i}: should measure cumulative sync performance impact on ${i}-member group using different worker with accumulated data`, async () => {
      const syncStart = performance.now();
      await allWorkers[run + 1].client.conversations.sync();
      const cumulativeSyncTimeMs = performance.now() - syncStart;
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        cumulativeSyncTimeMs,
      };
      run += 2;
    });
  }

  afterAll(() => {
    saveLog(summaryMap);
  });
});
