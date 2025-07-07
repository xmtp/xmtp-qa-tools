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
    small: {
      syncTime: 0,
      dbSize: 0,
      queryCount: 0,
      targetSizeMB: 10,
      existingGroups: 0,
    },
    medium: {
      syncTime: 0,
      dbSize: 0,
      queryCount: 0,
      targetSizeMB: 100,
      existingGroups: 0,
    },
    large: {
      syncTime: 0,
      dbSize: 0,
      queryCount: 0,
      targetSizeMB: 200,
      existingGroups: 0,
    },
    xl: {
      syncTime: 0,
      dbSize: 0,
      queryCount: 0,
      targetSizeMB: 400,
      existingGroups: 0,
    },
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
        const message = getMessageByMb(0.7);
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

    console.log("Populating inboxes to target size...");
    await populateInboxToSize(smallInbox, measurements.small.targetSizeMB);
    await populateInboxToSize(mediumInbox, measurements.medium.targetSizeMB);
    await populateInboxToSize(largeInbox, measurements.large.targetSizeMB);
    await populateInboxToSize(xlInbox, measurements.xl.targetSizeMB);

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
  it(`should perform syncAll on all inbox sizes`, async () => {
    const inboxes = [
      { worker: smallInbox, name: "small", key: "small" as const },
      { worker: mediumInbox, name: "medium", key: "medium" as const },
      { worker: largeInbox, name: "large", key: "large" as const },
      { worker: xlInbox, name: "xl", key: "xl" as const },
    ];

    for (const inbox of inboxes) {
      const syncStart = performance.now();
      await inbox.worker.client.conversations.syncAll();
      const syncTimeSeconds = Math.round(performance.now() - syncStart) / 1000;

      const dbSizes = await inbox.worker.worker.getSQLiteFileSizes();
      const stats = inbox.worker.client.debugInformation?.apiStatistics();

      // Store measurements
      measurements[inbox.key].syncTime = syncTimeSeconds * 1000;
      measurements[inbox.key].dbSize = dbSizes.total;
      measurements[inbox.key].existingGroups = await (
        await inbox.worker.client.conversations.list()
      ).length;
      measurements[inbox.key].queryCount = Number(
        stats?.queryGroupMessages || 0,
      );

      console.log(
        `${inbox.name} inbox queryGroupMessages: ${stats?.queryGroupMessages}`,
      );
      console.log(`${inbox.name} inbox sync time: ${syncTimeSeconds}s`);
      console.log(`${inbox.name} inbox db size: ${dbSizes.total}MB`);
    }
  });

  afterAll(async () => {
    await Promise.all([
      workers.getAll().map((worker) => {
        worker.client.debugInformation.clearAllStatistics();
      }),
    ]);

    // Generate summary table
    console.log("\n=== LARGE INBOX SYNC PERFORMANCE SUMMARY ===");
    console.log(
      "| Inbox Size | Sync Time (ms) | DB Size (MB) | Existing Groups | queryGroupMessages |",
    );
    console.log(
      "|------------|----------------|--------------|-----------------|------------------|",
    );
    console.log(
      `| Small      | ${measurements.small.syncTime}             | ${measurements.small.dbSize}            | ${measurements.small.existingGroups} | ${measurements.small.queryCount} |`,
    );
    console.log(
      `| Medium     | ${measurements.medium.syncTime}             | ${measurements.medium.dbSize}           | ${measurements.medium.existingGroups} | ${measurements.medium.queryCount}      |`,
    );
    console.log(
      `| Large      | ${measurements.large.syncTime}             | ${measurements.large.dbSize}          | ${measurements.large.existingGroups} | ${measurements.large.queryCount}      |`,
    );
    console.log(
      `| XL         | ${measurements.xl.syncTime}             | ${measurements.xl.dbSize}          | ${measurements.xl.existingGroups} | ${measurements.xl.queryCount}      |`,
    );
    console.log("==============================================\n");
  });
});
