import {
  verifyConversationStream,
  verifyMembershipStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

// Configuration
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
const BATCH_SIZE = process.env.BATCH_SIZE
  ? process.env.BATCH_SIZE.split(",").map((s) => parseInt(s.trim()))
  : [5, 10];

const testName = "large";
describe(testName, async () => {
  let workers: WorkerManager;

  workers = await getWorkers(WORKER_COUNT);

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

  for (const groupSize of BATCH_SIZE) {
    it(`verifyConversationStream-${groupSize}: should create ${groupSize} member group conversation stream`, async () => {
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`verifyMembershipStream-${groupSize}: should notify all members of additions in ${groupSize} member group`, async () => {
      const allMembers = getInboxIds(groupSize + 1);
      const membershipGroup = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers.slice(0, groupSize),
      );

      const verifyResult = await verifyMembershipStream(
        membershipGroup,
        workers.getAllButCreator(),
        allMembers.slice(groupSize, groupSize + 1),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`verifyMetadataStream-${groupSize}: should notify all members of metadata changes in ${groupSize} member group`, async () => {
      const metadataGroup = await workers.createGroupBetweenAll(
        "Metadata Stream Test",
        getInboxIds(groupSize),
      );

      await metadataGroup.sync();

      const verifyResult = await verifyMetadataStream(
        metadataGroup,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`verifySyncColdStart-${groupSize}: should perform cold start sync operations on ${groupSize} member group`, async () => {
      const createTime = performance.now();
      const allWorkers = workers.getAllButCreator();
      const workerA = allWorkers[run % allWorkers.length];
      const workerB = allWorkers[(run + 1) % allWorkers.length];

      await workers.createGroupBetweenAll(
        "Sync Cold Start Test",
        getInboxIds(groupSize),
      );
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
      const allWorkers = workers.getAllButCreator();

      await workers.createGroupBetweenAll(
        "Sync Cumulative Test",
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
