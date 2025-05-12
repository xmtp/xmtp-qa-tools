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

const testName = "ts_large_cumulative_syncs";
loadEnv(testName);

describe(testName, async () => {
  const steamsToTest = typeofStream.None;
  let workers: WorkerManager;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames(TS_LARGE_TOTAL / TS_LARGE_BATCH_SIZE + 2), // +2 for dedicated cumulative test workers
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

  // Get dedicated workers for cumulative sync tests
  // These workers will be added to all groups but won't sync until the end
  const allWorkers = workers.getWorkers();
  const cumulativeSyncAllWorker = allWorkers[0];
  const cumulativeSyncWorker = allWorkers[1];

  console.log(`Cumulative syncAll worker: ${cumulativeSyncAllWorker.name}`);
  console.log(`Cumulative sync worker: ${cumulativeSyncWorker.name}`);

  // Track created groups
  const createdGroups = [];

  // First phase: Create all groups and add the cumulative workers to each
  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`createGroup-${i}: create group with ${i} members`, async () => {
      try {
        const createTime = performance.now();
        const creator = workers.getCreator();
        console.log(
          `Creating group with ${i} members using creator: ${creator.name}`,
        );

        const newGroup = await creator.client.conversations.newGroup(
          generatedInboxes.slice(0, i).map((inbox) => inbox.inboxId),
          { groupName: `Group-${i}` },
        );

        // Add the cumulative sync test workers to every group
        await newGroup.addMembers([
          cumulativeSyncAllWorker.inboxId,
          cumulativeSyncWorker.inboxId,
        ]);

        createdGroups.push(newGroup);

        const createTimeMs = performance.now() - createTime;
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          createTimeMs,
        };

        console.log(`Group with ${i} members created in ${createTimeMs}ms`);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // Second phase: Measure cumulative sync performance
  // This happens after all groups are created
  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    const groupIndex = i / TS_LARGE_BATCH_SIZE - 1;
    const totalGroupsCreated = createdGroups.length;

    it(`cumulativeSyncAll-${i}: measure syncAll for worker added to ${groupIndex + 1} groups`, async () => {
      try {
        // Only perform the sync test when we've processed all group sizes up to this point
        if (
          groupIndex ===
          Math.min(totalGroupsCreated, i / TS_LARGE_BATCH_SIZE - 1)
        ) {
          console.log(
            `Testing syncAll after being added to ${groupIndex + 1} groups`,
          );

          const cumulativeSyncAllStart = performance.now();
          await cumulativeSyncAllWorker.client.conversations.syncAll();
          const cumulativeSyncAllTimeMs =
            performance.now() - cumulativeSyncAllStart;

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            cumulativeSyncAllTimeMs,
          };

          console.log(
            `Cumulative syncAll after ${groupIndex + 1} groups took ${cumulativeSyncAllTimeMs}ms`,
          );
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`cumulativeSync-${i}: measure sync for worker added to ${groupIndex + 1} groups`, async () => {
      try {
        // Only perform the sync test when we've processed all group sizes up to this point
        if (
          groupIndex ===
          Math.min(totalGroupsCreated, i / TS_LARGE_BATCH_SIZE - 1)
        ) {
          console.log(
            `Testing sync after being added to ${groupIndex + 1} groups`,
          );

          const cumulativeSyncStart = performance.now();
          await cumulativeSyncWorker.client.conversations.sync();
          const cumulativeSyncTimeMs = performance.now() - cumulativeSyncStart;

          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            cumulativeSyncTimeMs,
          };

          console.log(
            `Cumulative sync after ${groupIndex + 1} groups took ${cumulativeSyncTimeMs}ms`,
          );
        }
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
