import { getMessageByMb } from "@helpers/client";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "m_large_installations";
describe(testName, async () => {
  let workers = await getWorkers(["creator", "small", "medium", "large", "xl"]);

  let smallInbox: Worker;
  let mediumInbox: Worker;
  let largeInbox: Worker;
  let xlInbox: Worker;

  // Measurement data collection
  const measurements = {
    small: { syncTime: 0, dbSize: 0, queryCount: 0 },
    medium: { syncTime: 0, dbSize: 0, queryCount: 0 },
    large: { syncTime: 0, dbSize: 0, queryCount: 0 },
    xl: { syncTime: 0, dbSize: 0, queryCount: 0 },
  };

  // Helper function to populate inbox to target size
  async function populateInboxToSize(worker: Worker, targetSizeMB: number) {
    if (targetSizeMB === 0) return; // Skip for fresh inbox

    let currentDbSizes = await worker.worker.getSQLiteFileSizes();

    console.log(
      `Populating ${worker.name} inbox to ${targetSizeMB}MB (current: ${currentDbSizes.total}MB)`,
    );

    while (currentDbSizes.total < targetSizeMB) {
      const group = await worker.client.conversations.newGroup(getInboxIds(10));
      for (let i = 0; i < 5; i++) {
        const message = getMessageByMb(0.1);
        await group.send(message);
      }

      currentDbSizes = await worker.worker.getSQLiteFileSizes();
      console.log(`${worker.name} inbox db size: ${currentDbSizes.total}MB`);
    }

    console.log(`${worker.name} inbox populated to ${currentDbSizes.total}MB`);
  }

  beforeAll(async () => {
    smallInbox = workers.get("small")!;
    mediumInbox = workers.get("medium")!;
    largeInbox = workers.get("large")!;
    xlInbox = workers.get("xl")!;

    await Promise.all([
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    ]);
    await populateInboxToSize(smallInbox, 0);
    await populateInboxToSize(mediumInbox, 50);
    await populateInboxToSize(largeInbox, 100);
    await populateInboxToSize(xlInbox, 200);

    console.log("Performing initial sync on both inboxes...");
    await Promise.all([
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    ]);
    console.log("Initial sync completed");
  });

  it(`create measurable group after sync`, async () => {
    const memberPerGroup = 100;
    const group = await workers
      .get("creator")!
      .client.conversations.newGroup(
        workers.getAll().map((worker) => worker.client.inboxId),
      );
    const inboxIds = getInboxIds(memberPerGroup);
    for (let i = 0; i < inboxIds.length; i += 20) {
      const batch = inboxIds.slice(i, i + 20);
      await group.addMembers(batch);
    }
    for (let msgNum = 0; msgNum < 100; msgNum++) {
      const message = `Message ${msgNum + 1} in ${group.name}`;
      await group.send(message);
    }
  });

  it(`syncMedium: should perform syncAll on medium (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await mediumInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await mediumInbox.worker.getSQLiteFileSizes();
    const stats = await mediumInbox.client.debugInformation?.apiStatistics();

    // Store measurements
    measurements.medium.syncTime = syncTimeSeconds;
    measurements.medium.dbSize = dbSizes.total;
    measurements.medium.queryCount = Number(stats?.queryGroupMessages || 0);

    console.log(
      `Medium inbox queryGroupMessages: ${stats?.queryGroupMessages}`,
    );
    console.log(`Medium inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Medium inbox db size: ${dbSizes.total}MB`);
  });
  it(`syncLarge: should perform syncAll on large (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await largeInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await largeInbox.worker.getSQLiteFileSizes();
    const stats = await largeInbox.client.debugInformation?.apiStatistics();

    // Store measurements
    measurements.large.syncTime = syncTimeSeconds;
    measurements.large.dbSize = dbSizes.total;
    measurements.large.queryCount = Number(stats?.queryGroupMessages || 0);

    console.log(`Large inbox queryGroupMessages: ${stats?.queryGroupMessages}`);
    console.log(`Large inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Large inbox db size: ${dbSizes.total}MB`);
  });

  it(`syncXL: should perform syncAll on xl (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await xlInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await xlInbox.worker.getSQLiteFileSizes();
    const stats = await xlInbox.client.debugInformation?.apiStatistics();

    // Store measurements
    measurements.xl.syncTime = syncTimeSeconds;
    measurements.xl.dbSize = dbSizes.total;
    measurements.xl.queryCount = Number(stats?.queryGroupMessages || 0);

    console.log(`XL inbox queryGroupMessages: ${stats?.queryGroupMessages}`);
    console.log(`XL inbox sync time: ${syncTimeSeconds}s`);
    console.log(`XL inbox db size: ${dbSizes.total}MB`);
  });

  it(`syncSmall: should perform syncAll on small (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await smallInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await smallInbox.worker.getSQLiteFileSizes();
    const stats = await smallInbox.client.debugInformation?.apiStatistics();

    // Store measurements
    measurements.small.syncTime = syncTimeSeconds;
    measurements.small.dbSize = dbSizes.total;
    measurements.small.queryCount = Number(stats?.queryGroupMessages || 0);

    console.log(`Small inbox queryGroupMessages: ${stats?.queryGroupMessages}`);
    console.log(`Small inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Small inbox db size: ${dbSizes.total}MB`);
  });

  afterAll(async () => {
    await Promise.all([
      workers.getAll().map((worker) => {
        worker.client.debugInformation.clearAllStatistics();
      }),
    ]);

    // Generate summary table
    console.log("\n=== LARGE INBOX SYNC PERFORMANCE SUMMARY ===");
    console.log("| Inbox Size | Sync Time (s) | DB Size (MB) | Query Count |");
    console.log("|------------|---------------|--------------|-------------|");
    console.log(
      `| Small      | ${measurements.small.syncTime}             | ${measurements.small.dbSize}            | ${measurements.small.queryCount} |`,
    );
    console.log(
      `| Medium     | ${measurements.medium.syncTime}             | ${measurements.medium.dbSize}           | ${measurements.medium.queryCount}      |`,
    );
    console.log(
      `| Large      | ${measurements.large.syncTime}             | ${measurements.large.dbSize}          | ${measurements.large.queryCount}      |`,
    );
    console.log(
      `| XL         | ${measurements.xl.syncTime}             | ${measurements.xl.dbSize}          | ${measurements.xl.queryCount}      |`,
    );
    console.log("==============================================\n");
  });
});
