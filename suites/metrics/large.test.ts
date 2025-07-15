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
const BATCH_SIZE = process.env.BATCH_SIZE
  ? (JSON.parse(process.env.BATCH_SIZE) as number[])
  : [5, 10];

const testName = "large_";
describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  let workers: WorkerManager;

  workers = await getWorkers(WORKER_COUNT);

  let allMembers: string[] = [];
  let allMembersWithExtra: string[] = [];
  let newGroupBetweenAll: Group;
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
    it(`conversationStream-${groupSize}: should create ${groupSize} member group conversation stream`, async () => {
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`newGroup-${groupSize}: should create a large group of ${groupSize} participants`, async () => {
      allMembersWithExtra = getInboxIds(groupSize + 1);
      allMembers = allMembersWithExtra.slice(0, groupSize);

      newGroupBetweenAll = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers,
      );
    });

    it(`addMember-${groupSize}: should notify all members of additions in ${groupSize} member group`, async () => {
      const extraMember = allMembersWithExtra.slice(groupSize, groupSize + 1);
      console.log("extraMember", extraMember);
      const verifyResult = await verifyMembershipStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${groupSize}: should notify all members of message changes in ${groupSize} member group`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`updateName-${groupSize}: should notify all members of metadata changes in ${groupSize} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${groupSize}: should perform cold start sync operations on ${groupSize} member group`, async () => {
      const createTime = performance.now();
      const allWorkers = workers.getAllButCreator();
      const workerA = allWorkers[run % allWorkers.length];
      const workerB = allWorkers[(run + 1) % allWorkers.length];

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

    it(`syncCumulative-${groupSize}: should perform cumulative sync operations on ${groupSize} member group`, async () => {
      const createTime = performance.now();
      const allWorkers = workers.getAllButCreator();

      const workersToAdd = allWorkers.slice(run % allWorkers.length, run + 2);

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
