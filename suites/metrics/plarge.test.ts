import {
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

// Configuration
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "5");
const MAX_GROUP_SIZE = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

const testName = "large";
describe(testName, async () => {
  let workers: WorkerManager;

  const batchSizes = getBatchSizes();

  // Setup workers with enough capacity for all tests
  const maxWorkersNeeded = Math.max(
    WORKER_COUNT,
    (MAX_GROUP_SIZE / BATCH_SIZE) * 2 + 5,
  );
  workers = await getWorkers(maxWorkersNeeded);

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
  });

  let run = 0; // Worker allocation counter

  for (const groupSize of batchSizes) {
    // it(`verifyMembershipStream-${groupSize}: should notify all members of additions in ${groupSize} member group`, async () => {
    //   const creator = workers.getCreator();
    //   const membershipGroup = (await creator.client.conversations.newGroup(
    //     getInboxIds(groupSize),
    //   )) as Group;

    //   const verifyResult = await verifyMembershipStream(
    //     membershipGroup,
    //     workers.getAllButCreator(),
    //     getInboxIds(1),
    //   );

    //   setCustomDuration(verifyResult.averageEventTiming);
    //   expect(verifyResult.almostAllReceived).toBe(true);
    // });

    it(`verifyMessageStream-${groupSize}: should deliver messages to all ${groupSize} members`, async () => {
      const creator = workers.getCreator();
      const group = (await creator.client.conversations.newGroup(
        getInboxIds(groupSize),
      )) as Group;
      await group.sync();
      await group.addMembers(
        workers
          .getAllButCreator()

          .map((worker) => worker.client.inboxId),
      );

      await group.sync();
      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`verifyConversationStream-${groupSize}: should create ${groupSize} member group conversation stream`, async () => {
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    // it(`verifyMetadataStream-${groupSize}: should notify all members of metadata changes in ${groupSize} member group`, async () => {
    //   const creator = workers.getCreator();
    //   const metadataGroup = (await creator.client.conversations.newGroup(
    //     getInboxIds(groupSize),
    //   )) as Group;

    //   const verifyResult = await verifyMetadataStream(
    //     metadataGroup,
    //     workers.getAllButCreator(),
    //   );

    //   setCustomDuration(verifyResult.averageEventTiming);
    //   expect(verifyResult.almostAllReceived).toBe(true);
    // });

    it(`verifySyncColdStart-${groupSize}: should perform cold start sync operations on ${groupSize} member group`, async () => {
      const createTime = performance.now();
      const creator = workers.getCreator();
      const allWorkers = workers.getAllButCreator();
      const workerA = allWorkers[run % allWorkers.length];
      const workerB = allWorkers[(run + 1) % allWorkers.length];

      const newGroup = await creator.client.conversations.newGroup(
        getInboxIds(groupSize),
      );
      await newGroup.addMembers([workerA.inboxId, workerB.inboxId]);
      const createTimeMs = performance.now() - createTime;

      // Test syncAll
      const syncAllStart = performance.now();
      await workerA.client.conversations.syncAll();
      const singleSyncAllTimeMs = performance.now() - syncAllStart;

      // Test individual sync
      const syncStart = performance.now();
      await workerB.client.conversations.sync();
      const singleSyncTimeMs = performance.now() - syncStart;

      console.log(
        `Group ${groupSize} sync times: create=${createTimeMs}ms, syncAll=${singleSyncAllTimeMs}ms, sync=${singleSyncTimeMs}ms`,
      );
    });

    it(`verifySyncCumulative-${groupSize}: should perform cumulative sync operations on ${groupSize} member group`, async () => {
      const createTime = performance.now();
      const creator = workers.getCreator();
      const allWorkers = workers.getAllButCreator();

      const newGroup = await creator.client.conversations.newGroup(
        getInboxIds(groupSize),
      );

      const workersToAdd = allWorkers.slice(
        run % allWorkers.length,
        (run % allWorkers.length) + 3,
      );
      if (workersToAdd.length < 3) {
        // Wrap around if needed
        workersToAdd.push(...allWorkers.slice(0, 3 - workersToAdd.length));
      }

      await newGroup.addMembers(workersToAdd.map((worker) => worker.inboxId));
      const cumulativeCreateTimeMs = performance.now() - createTime;

      // Test cumulative syncAll
      const syncAllStart = performance.now();
      await workersToAdd[0].client.conversations.syncAll();
      const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;

      // Test cumulative individual sync
      const syncStart = performance.now();
      await workersToAdd[1].client.conversations.sync();
      const cumulativeSyncTimeMs = performance.now() - syncStart;

      console.log(
        `Group ${groupSize} cumulative sync times: create=${cumulativeCreateTimeMs}ms, syncAll=${cumulativeSyncAllTimeMs}ms, sync=${cumulativeSyncTimeMs}ms`,
      );

      run += 2; // Move to next worker pair
    });
  }
});

const getBatchSizes = (): number[] => {
  const sizes = new Set([10]); // Always include baseline
  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    sizes.add(i);
  }
  return Array.from(sizes).sort((a, b) => a - b);
};
