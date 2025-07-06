import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, describe, it } from "vitest";
import { m_large_BATCH_SIZE, m_large_TOTAL, saveLog } from "./helpers";

const testName = "m_large_installations";
describe(testName, async () => {
  setupTestLifecycle({
    testName,
  });
  const summaryMap: Record<number, any> = {};

  let workers = await getWorkers(2, {
    randomNames: false,
  });

  let freshInbox: Worker;
  let populatedInbox: Worker;

  for (
    let i = m_large_BATCH_SIZE;
    i <= m_large_TOTAL;
    i += m_large_BATCH_SIZE
  ) {
    it(`setup-${i}: should create ${i} groups with 100 messages each`, async () => {
      const setupTime = performance.now();
      freshInbox = workers.get("bob")!;
      populatedInbox = workers.get("alice")!;

      console.log(
        JSON.stringify(
          {
            freshInbox: freshInbox.name,
            populatedInbox: populatedInbox.name,
            groupsToCreate: i,
          },
          null,
          2,
        ),
      );

      // Create groups and populate with messages in the populated inbox
      const groups = [];
      for (let groupNum = 0; groupNum < i; groupNum++) {
        const group = await populatedInbox.client.conversations.newGroup([]);
        const groupName = `Group-${groupNum + 1}-${Date.now()}`;
        await group.updateName(groupName);

        // Add 100 messages per group
        for (let msgNum = 0; msgNum < 100; msgNum++) {
          const message = `Message ${msgNum + 1} in ${groupName}`;
          await group.send(message);
        }

        groups.push(group);

        // Log progress every 10 groups
        if ((groupNum + 1) % 10 === 0) {
          console.log(`Created ${groupNum + 1}/${i} groups`);
        }
      }

      const setupTimeMs = performance.now() - setupTime;
      const setupTimeSeconds = setupTimeMs / 1000;
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        setupTimeSeconds,
      };
    });

    it(`syncFresh-${i}: should perform syncAll on fresh inbox`, async () => {
      const syncFreshStart = performance.now();
      await freshInbox.client.conversations.syncAll();
      const freshSyncTimeMs = performance.now() - syncFreshStart;
      const freshSyncTimeSeconds = freshSyncTimeMs / 1000;

      // Get database size for fresh inbox
      const freshDbSizes = await freshInbox.worker.getSQLiteFileSizes();
      const freshDbSizeMB = freshDbSizes.total / (1024 * 1024);

      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        freshSyncTimeSeconds,
        freshDbSizeMB,
      };
    });

    it(`syncPopulated-${i}: should perform syncAll on populated inbox with ${i} groups`, async () => {
      const syncPopulatedStart = performance.now();
      await populatedInbox.client.conversations.syncAll();
      const populatedSyncTimeMs = performance.now() - syncPopulatedStart;
      const populatedSyncTimeSeconds = populatedSyncTimeMs / 1000;

      // Get database size for populated inbox
      const populatedDbSizes = await populatedInbox.worker.getSQLiteFileSizes();
      const populatedDbSizeMB = populatedDbSizes.total / (1024 * 1024);

      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        populatedSyncTimeSeconds,
        populatedDbSizeMB,
      };
    });

    it(`syncDifference-${i}: should calculate sync time difference`, () => {
      const entry = summaryMap[i];
      if (entry?.freshSyncTimeSeconds && entry?.populatedSyncTimeSeconds) {
        const syncDifferenceSeconds =
          entry.populatedSyncTimeSeconds - entry.freshSyncTimeSeconds;
        const syncRatio =
          entry.populatedSyncTimeSeconds / entry.freshSyncTimeSeconds;

        // Calculate database size differences
        const dbSizeDifferenceMB =
          (entry.populatedDbSizeMB || 0) - (entry.freshDbSizeMB || 0);
        const dbSizeRatio = entry.freshDbSizeMB
          ? (entry.populatedDbSizeMB || 0) / entry.freshDbSizeMB
          : 0;

        summaryMap[i] = {
          ...entry,
          syncDifferenceSeconds,
          syncRatio,
          dbSizeDifferenceMB,
          dbSizeRatio,
        };

        console.log(
          JSON.stringify(
            {
              groups: i,
              freshSyncSeconds: entry.freshSyncTimeSeconds,
              populatedSyncSeconds: entry.populatedSyncTimeSeconds,
              differenceSeconds: syncDifferenceSeconds,
              ratio: syncRatio,
              freshDbMB: entry.freshDbSizeMB,
              populatedDbMB: entry.populatedDbSizeMB,
              dbDifferenceMB: dbSizeDifferenceMB,
              dbRatio: dbSizeRatio,
            },
            null,
            2,
          ),
        );
      }
    });
  }

  afterAll(() => {
    saveLog(summaryMap);
  });
});
