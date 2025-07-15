import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog } from "./helpers";

const testName = "large_cumulative_syncs";
describe(testName, async () => {
  setupTestLifecycle({
    testName,
    sendMetrics: true,
  });
  let workers: WorkerManager;

  const summaryMap: Record<number, any> = {};

  workers = await getWorkers((MAX_GROUP_SIZE / BATCH_SIZE) * 2 + 3);
  // Note: No streams needed for this test (was set to None)
  let allWorkers: Worker[];
  // Use different workers for each measurement
  allWorkers = workers.getAllButCreator();

  // Dedicated 10-person group test sequence (independent of batch configuration)
  it(`newGroup-10-baseline: should create 10 member group and add all worker members (baseline)`, async () => {
    const createTime = performance.now();
    const creator = workers.getCreator();
    console.log("Creator name: ", creator.name);
    const newGroup = await creator.client.conversations.newGroup(
      getInboxIds(10),
    );
    await newGroup.addMembers(allWorkers.map((worker) => worker.inboxId));
    const createTimeMs = performance.now() - createTime;
    summaryMap[10] = {
      ...(summaryMap[10] ?? { groupSize: 10 }),
      createTimeMs,
      isBaseline: true,
    };
  });

  it(`syncAll-10-baseline: should measure cumulative syncAll performance impact on 10-member group with growing conversation history (baseline)`, async () => {
    const syncAllStart = performance.now();
    await allWorkers[0].client.conversations.syncAll();
    const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;
    summaryMap[10] = {
      ...(summaryMap[10] ?? { groupSize: 10 }),
      cumulativeSyncAllTimeMs,
      isBaseline: true,
    };
  });

  it(`sync-10-baseline: should measure cumulative sync performance impact on 10-member group using different worker with accumulated data (baseline)`, async () => {
    const syncStart = performance.now();
    await allWorkers[1].client.conversations.sync();
    const cumulativeSyncTimeMs = performance.now() - syncStart;
    summaryMap[10] = {
      ...(summaryMap[10] ?? { groupSize: 10 }),
      cumulativeSyncTimeMs,
      isBaseline: true,
    };
  });

  // Batch-based tests (existing behavior)
  let run = 2; // Start after baseline workers
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
