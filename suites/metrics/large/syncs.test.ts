import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, describe, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog } from "./helpers";

const testName = "large_syncs";
describe(testName, async () => {
  setupTestLifecycle({
    testName,
    metrics: true,
  });
  const summaryMap: Record<number, any> = {};

  let workers = await getWorkers((MAX_GROUP_SIZE / BATCH_SIZE) * 2 + 1, {
    randomNames: false,
  });
  // Note: No streams needed for this test (was set to None)
  let allWorkers: Worker[];
  // Use different workers for each measurement
  allWorkers = workers.getAllButCreator();

  let workerA: Worker;
  let workerB: Worker;
  let run = 0;
  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    it(`newGroup-${i}: should create new ${i} member group`, async () => {
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
    });

    it(`syncAll-${i}: should perform cold start syncAll operation on ${i} member group`, async () => {
      const syncAllStart = performance.now();
      await workerA.client.conversations.syncAll();
      const singleSyncAllTimeMs = performance.now() - syncAllStart;
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        singleSyncAllTimeMs,
      };
    });

    it(`sync-${i}: should perform cold start sync operation on ${i} member group`, async () => {
      const syncStart = performance.now();
      await workerB.client.conversations.sync();
      const singleSyncTimeMs = performance.now() - syncStart;
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        singleSyncTimeMs,
      };
      run += 2;
    });
  }

  afterAll(() => {
    saveLog(summaryMap);
  });
});
