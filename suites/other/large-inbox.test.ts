import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, it } from "vitest";
import { m_large_BATCH_SIZE, m_large_TOTAL } from "../metrics/large/helpers";

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

  beforeAll(async () => {
    freshInbox = workers.get("bob")!;
    populatedInbox = workers.get("alice")!;

    console.log(
      `Setup: Fresh inbox: ${freshInbox.name}, Populated inbox: ${populatedInbox.name}`,
    );

    // Initial sync to establish baseline
    console.log("Performing initial sync on both inboxes...");
    await freshInbox.client.conversations.syncAll();
    await populatedInbox.client.conversations.syncAll();
    console.log("Initial sync completed");
  });

  it(`setup-${i}: should create ${i} new groups with 100 messages each`, async () => {
    console.log(`Creating ${i} new groups with 100 messages each...`);

    // Create new groups and populate with messages (no timing here)
    for (let groupNum = 0; groupNum < i; groupNum++) {
      const group = await workers.createGroupBetweenAll();
      // Add 100 messages per group
      for (let msgNum = 0; msgNum < 100; msgNum++) {
        const message = `Message ${msgNum + 1} in ${group.name}`;
        await group.send(message);
      }
    }

    console.log(`Setup completed - ${i} groups created and synced`);
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

  it(`results-${i}: should show final sync times and db sizes`, () => {
    const entry = summaryMap[i];
    if (entry?.freshSyncTimeSeconds && entry?.populatedSyncTimeSeconds) {
      console.log(`\n=== ${i} Groups Results ===`);
      console.log(
        `Fresh Inbox    - Sync: ${entry.freshSyncTimeSeconds.toFixed(3)}s, DB: ${entry.freshDbSizeMB.toFixed(1)}MB`,
      );
      console.log(
        `Populated Inbox - Sync: ${entry.populatedSyncTimeSeconds.toFixed(3)}s, DB: ${entry.populatedDbSizeMB.toFixed(1)}MB`,
      );
      console.log(
        `Difference     - Sync: ${(entry.populatedSyncTimeSeconds - entry.freshSyncTimeSeconds).toFixed(3)}s, DB: ${(entry.populatedDbSizeMB - entry.freshDbSizeMB).toFixed(1)}MB`,
      );
      console.log(
        `Ratio          - Sync: ${(entry.populatedSyncTimeSeconds / entry.freshSyncTimeSeconds).toFixed(1)}x, DB: ${(entry.populatedDbSizeMB / entry.freshDbSizeMB).toFixed(1)}x`,
      );
    }
  });
});
