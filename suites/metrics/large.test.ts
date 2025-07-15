import fs from "fs";
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
import { afterAll, describe, expect, it } from "vitest";

// Configuration
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "5");
const MAX_GROUP_SIZE = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

// Enhanced logging function
function saveLog(summaryMap: Record<string, any>) {
  if (Object.keys(summaryMap).length === 0) {
    return;
  }

  const sorted = Object.values(summaryMap).sort(
    (a, b) =>
      a.groupSize - b.groupSize ||
      (a.installations ?? 0) - (b.installations ?? 0),
  );

  let messageToLog = "\n===== Large Test Suite Performance Summary =====\n";

  for (const entry of sorted) {
    messageToLog += `Group ${entry.groupSize}`;
    if (entry.installations !== undefined) {
      messageToLog += ` (${entry.installations} inst)`;
    }
    if (entry.isBaseline) {
      messageToLog += " [BASELINE]";
    }
    messageToLog += " → ";
    messageToLog += JSON.stringify(entry, null, 0);
    messageToLog += "\n";
  }

  messageToLog += "\n============================================\n";
  console.log(messageToLog);

  // Ensure logs directory exists and save
  try {
    fs.appendFileSync("logs/large.log", messageToLog);
  } catch (error) {
    console.warn("Could not write to logs/large.log:", error instanceof Error ? error.message : String(error));
  }
}

const testName = "large";
describe(testName, async () => {
  let workers: WorkerManager;
  let summaryMap: Record<number, any> = {};

  // Setup workers with enough capacity for all tests
  const maxWorkersNeeded = Math.max(
    WORKER_COUNT,
    (MAX_GROUP_SIZE / BATCH_SIZE) * 2 + 5,
  );
  workers = await getWorkers(maxWorkersNeeded, { randomNames: false });

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

  // ==========================================================================
  // BASELINE TESTS (10-person groups) - Independent of batch configuration
  // ==========================================================================

  describe("Baseline Tests (10-person groups)", () => {
    let baselineGroup: Group;

    it("should deliver messages to all 10 members (baseline)", async () => {
      const creator = workers.getCreator();
      baselineGroup = (await creator.client.conversations.newGroup(
        getInboxIds(10),
      )) as Group;
      await baselineGroup.sync();
      await baselineGroup.addMembers(
        workers
          .getAllButCreator()
          .slice(0, WORKER_COUNT - 1)
          .map((worker) => worker.client.inboxId),
      );

      await baselineGroup.sync();
      const verifyResult = await verifyMessageStream(
        baselineGroup,
        workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
      );

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        messageStreamTimeMs: verifyResult.averageEventTiming,
        isBaseline: true,
      };

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it("should create 10 member group conversation stream (baseline)", async () => {
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
      );

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        conversationStreamTimeMs: verifyResult.averageEventTiming,
        isBaseline: true,
      };

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it("should notify all members of additions in 10 member group (baseline)", async () => {
      const creator = workers.getCreator();
      const membershipGroup = (await creator.client.conversations.newGroup(
        getInboxIds(10),
      )) as Group;

      const verifyResult = await verifyMembershipStream(
        membershipGroup,
        workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
        getInboxIds(1),
      );

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        membershipStreamTimeMs: verifyResult.averageEventTiming,
        isBaseline: true,
      };

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it("should notify all members of metadata changes in 10 member group (baseline)", async () => {
      const creator = workers.getCreator();
      const metadataGroup = (await creator.client.conversations.newGroup(
        getInboxIds(10),
      )) as Group;

      const verifyResult = await verifyMetadataStream(
        metadataGroup,
        workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
      );

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        metadataStreamTimeMs: verifyResult.averageEventTiming,
        isBaseline: true,
      };

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it("should perform cold start sync operations on 10 member group (baseline)", async () => {
      const createTime = performance.now();
      const creator = workers.getCreator();
      const allWorkers = workers.getAllButCreator();
      const baselineWorkerA = allWorkers[0];
      const baselineWorkerB = allWorkers[1];

      const newGroup = await creator.client.conversations.newGroup(
        getInboxIds(10),
      );
      await newGroup.addMembers([
        baselineWorkerA.inboxId,
        baselineWorkerB.inboxId,
      ]);
      const createTimeMs = performance.now() - createTime;

      // Test syncAll
      const syncAllStart = performance.now();
      await baselineWorkerA.client.conversations.syncAll();
      const singleSyncAllTimeMs = performance.now() - syncAllStart;

      // Test individual sync
      const syncStart = performance.now();
      await baselineWorkerB.client.conversations.sync();
      const singleSyncTimeMs = performance.now() - syncStart;

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        createTimeMs,
        singleSyncAllTimeMs,
        singleSyncTimeMs,
        isBaseline: true,
      };
    });

    it("should perform cumulative sync operations on 10 member group (baseline)", async () => {
      const createTime = performance.now();
      const creator = workers.getCreator();
      const allWorkers = workers.getAllButCreator();

      const newGroup = await creator.client.conversations.newGroup(
        getInboxIds(10),
      );
      await newGroup.addMembers(
        allWorkers.slice(0, 3).map((worker) => worker.inboxId),
      );
      const cumulativeCreateTimeMs = performance.now() - createTime;

      // Test cumulative syncAll
      const syncAllStart = performance.now();
      await allWorkers[0].client.conversations.syncAll();
      const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;

      // Test cumulative individual sync
      const syncStart = performance.now();
      await allWorkers[1].client.conversations.sync();
      const cumulativeSyncTimeMs = performance.now() - syncStart;

      summaryMap[10] = {
        ...(summaryMap[10] ?? { groupSize: 10 }),
        cumulativeCreateTimeMs,
        cumulativeSyncAllTimeMs,
        cumulativeSyncTimeMs,
        isBaseline: true,
      };
    });
  });

  // ==========================================================================
  // BATCH TESTS - Variable group sizes based on configuration
  // ==========================================================================

  describe("Batch Tests (Variable Group Sizes)", () => {
    let run = 5; // Start worker allocation after baseline tests

    for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
      describe(`Group Size ${i}`, () => {
        let batchGroup: Group;

        it(`should deliver messages to all ${i} members`, async () => {
          const creator = workers.getCreator();
          batchGroup = (await creator.client.conversations.newGroup(
            getInboxIds(i),
          )) as Group;
          await batchGroup.sync();
          await batchGroup.addMembers(
            workers
              .getAllButCreator()
              .slice(0, WORKER_COUNT - 1)
              .map((worker) => worker.client.inboxId),
          );

          await batchGroup.sync();
          const verifyResult = await verifyMessageStream(
            batchGroup,
            workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
          );

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            messageStreamTimeMs: verifyResult.averageEventTiming,
          };

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        });

        it(`should create ${i} member group conversation stream`, async () => {
          const verifyResult = await verifyConversationStream(
            workers.getCreator(),
            workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
          );

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            conversationStreamTimeMs: verifyResult.averageEventTiming,
          };

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        });

        it(`should notify all members of additions in ${i} member group`, async () => {
          const creator = workers.getCreator();
          const membershipGroup = (await creator.client.conversations.newGroup(
            getInboxIds(i),
          )) as Group;

          const verifyResult = await verifyMembershipStream(
            membershipGroup,
            workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
            getInboxIds(1),
          );

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            membershipStreamTimeMs: verifyResult.averageEventTiming,
          };

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        });

        it(`should notify all members of metadata changes in ${i} member group`, async () => {
          const creator = workers.getCreator();
          const metadataGroup = (await creator.client.conversations.newGroup(
            getInboxIds(i),
          )) as Group;

          const verifyResult = await verifyMetadataStream(
            metadataGroup,
            workers.getAllButCreator().slice(0, WORKER_COUNT - 1),
          );

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            metadataStreamTimeMs: verifyResult.averageEventTiming,
          };

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        });

        it(`should perform cold start sync operations on ${i} member group`, async () => {
          const createTime = performance.now();
          const creator = workers.getCreator();
          const allWorkers = workers.getAllButCreator();
          const workerA = allWorkers[run];
          const workerB = allWorkers[run + 1];

          const newGroup = await creator.client.conversations.newGroup(
            getInboxIds(i),
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

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            createTimeMs,
            singleSyncAllTimeMs,
            singleSyncTimeMs,
          };
        });

        it(`should perform cumulative sync operations on ${i} member group`, async () => {
          const createTime = performance.now();
          const creator = workers.getCreator();
          const allWorkers = workers.getAllButCreator();

          const newGroup = await creator.client.conversations.newGroup(
            getInboxIds(i),
          );
          await newGroup.addMembers(
            allWorkers.slice(run, run + 3).map((worker) => worker.inboxId),
          );
          const cumulativeCreateTimeMs = performance.now() - createTime;

          // Test cumulative syncAll
          const syncAllStart = performance.now();
          await allWorkers[run].client.conversations.syncAll();
          const cumulativeSyncAllTimeMs = performance.now() - syncAllStart;

          // Test cumulative individual sync
          const syncStart = performance.now();
          await allWorkers[run + 1].client.conversations.sync();
          const cumulativeSyncTimeMs = performance.now() - syncStart;

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            cumulativeCreateTimeMs,
            cumulativeSyncAllTimeMs,
            cumulativeSyncTimeMs,
          };

          run += 2; // Move to next worker pair
        });
      });
    }
  });

  // ==========================================================================
  // CLEANUP AND REPORTING
  // ==========================================================================

  afterAll(() => {
    saveLog(summaryMap);
  });
});
