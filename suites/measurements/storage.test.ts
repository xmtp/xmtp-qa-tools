import { formatBytes, getMessageByMb } from "@helpers/client";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxIds, getRandomInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

interface StorageMetrics {
  totalSizeMB: number;
  numberOfGroups: number;
  membersPerGroup: number;
  sizePerGroupMB: number;
  receiverSizeMB: number;
  costPerMemberMB: number;
}

interface PerformanceMetrics {
  syncTime: number;
  dbSize: number;
  queryCount: number;
  existingGroups: number;
}

const memberCounts = [2, 10, 50, 100, 150, 200];
const targetSizeMB = 5;

// Inbox size configurations for performance testing
const inboxSizes = {
  small: { targetSizeMB: 10, name: "small" },
  medium: { targetSizeMB: 100, name: "medium" },
  large: { targetSizeMB: 200, name: "large" },
  xl: { targetSizeMB: 400, name: "xl" },
} as const;

const testName = "storage";
describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });

  // Performance measurement data collection
  const performanceMeasurements: Record<
    keyof typeof inboxSizes,
    PerformanceMetrics
  > = {
    small: { syncTime: 0, dbSize: 0, queryCount: 0, existingGroups: 0 },
    medium: { syncTime: 0, dbSize: 0, queryCount: 0, existingGroups: 0 },
    large: { syncTime: 0, dbSize: 0, queryCount: 0, existingGroups: 0 },
    xl: { syncTime: 0, dbSize: 0, queryCount: 0, existingGroups: 0 },
  };

  // Helper function to populate inbox to target size
  async function populateInboxToSize(worker: Worker, targetSizeMB: number) {
    if (targetSizeMB === 0) return;

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

  it("generate storage efficiency table for different group sizes", async () => {
    const results: StorageMetrics[] = [];
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const memberCount = 2;
    const name = `sender${randomSuffix}-${memberCount}`;
    const receiverName = `receiver${randomSuffix}-${memberCount}`;
    const workers = await getWorkers([name, receiverName]);

    const sender = workers.get(name);
    const receiver = workers.get(receiverName);
    for (const memberCount of memberCounts) {
      console.time(`Testing ${memberCount}-member groups`);
      console.log(`\n🔄 Testing ${memberCount}-member groups...`);

      let groupCount = 0;
      const memberInboxIds = getRandomInboxIds(memberCount - 2);
      let senderInstallationSize = await sender?.worker.getSQLiteFileSizes();
      let receiverInstallationSize =
        await receiver?.worker.getSQLiteFileSizes();
      let currentTotalSize = 0;
      while (currentTotalSize < targetSizeMB * 1024 * 1024) {
        const group = await sender?.client.conversations.newGroup([
          ...memberInboxIds,
          receiver?.inboxId as string,
        ]);
        void group?.send("hi");
        groupCount++;
        let senderSizes = await sender?.worker.getSQLiteFileSizes();
        let receiverSizes = await receiver?.worker.getSQLiteFileSizes();
        currentTotalSize =
          (senderSizes?.dbFile ?? 0) - (senderInstallationSize?.dbFile ?? 0);
        console.log(
          `  Created ${groupCount} groups of ${memberCount} members with total size: ${formatBytes(
            currentTotalSize,
          )} and receiver size: ${formatBytes(
            (receiverSizes?.dbFile ?? 0) -
              (receiverInstallationSize?.dbFile ?? 0),
          )}`,
        );
      }
      await workers.checkForks();

      const finalSizeMB = currentTotalSize / (1024 * 1024);
      const sizePerGroupMB = finalSizeMB / groupCount;
      console.time("Syncing receiver");
      await receiver?.client.conversations.syncAll();
      console.timeEnd("Syncing receiver");
      const finalReceiverSizes = await receiver?.worker.getSQLiteFileSizes();
      const metrics: StorageMetrics = {
        totalSizeMB: finalSizeMB,
        numberOfGroups: groupCount,
        membersPerGroup: memberCount,
        sizePerGroupMB,
        receiverSizeMB:
          (finalReceiverSizes?.dbFile ?? 0) -
          (receiverInstallationSize?.dbFile ?? 0) / (1024 * 1024),
        costPerMemberMB: (sizePerGroupMB / memberCount) * 1000,
      };

      results.push(metrics);
      console.log(
        `✅ ${memberCount}-member groups: ${groupCount} groups, ${finalSizeMB.toFixed(2)} MB total`,
      );
      console.timeEnd(`Testing ${memberCount}-member groups`);
    }

    // Build complete output string
    let output = "\n## Storage Efficiency Analysis\n";
    output +=
      "| Group Size | Groups | Sender storage | Avg Group Size | Receiver storage | Efficiency Gain |\n";
    output +=
      "|------------|--------|---------------|----------------|-----------------|-----------------|";

    // Calculate baseline (2 members) for efficiency comparison
    const baseline = results.find((r) => r.membersPerGroup === 2);
    const baselineCostPerMember = baseline?.costPerMemberMB || 1;

    for (const result of results) {
      const efficiencyGain =
        result.membersPerGroup === 2
          ? "baseline"
          : `${(baselineCostPerMember / result.costPerMemberMB).toFixed(1)}× better`;

      output += `\n| ${result.membersPerGroup} members | ${result.numberOfGroups} | ${result.totalSizeMB.toFixed(1)} MB | ${result.sizePerGroupMB.toFixed(3)} MB | ${formatBytes(result.receiverSizeMB)} | ${efficiencyGain} |`;
    }
    output += "\n\n" + "=".repeat(80);
    console.log(output);
  });

  it("measure sync performance across different inbox sizes", async () => {
    const workers = await getWorkers([
      "creator",
      "small",
      "medium",
      "large",
      "xl",
    ]);

    const smallInbox = workers.get("small")!;
    const mediumInbox = workers.get("medium")!;
    const largeInbox = workers.get("large")!;
    const xlInbox = workers.get("xl")!;

    // Populate inboxes to target size
    console.log("Populating inboxes to target size...");
    await populateInboxToSize(smallInbox, inboxSizes.small.targetSizeMB);
    await populateInboxToSize(mediumInbox, inboxSizes.medium.targetSizeMB);
    await populateInboxToSize(largeInbox, inboxSizes.large.targetSizeMB);
    await populateInboxToSize(xlInbox, inboxSizes.xl.targetSizeMB);

    console.log("Performing initial sync on all inboxes...");
    await Promise.all([
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    ]);
    console.log("Initial sync completed");

    // Create a large group to test sync performance
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

    // Test sync performance on all inbox sizes
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
      performanceMeasurements[inbox.key].syncTime = syncTimeSeconds * 1000;
      performanceMeasurements[inbox.key].dbSize = dbSizes.total;
      performanceMeasurements[inbox.key].existingGroups = await (
        await inbox.worker.client.conversations.list()
      ).length;
      performanceMeasurements[inbox.key].queryCount = Number(
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
    const workers = await getWorkers([
      "creator",
      "small",
      "medium",
      "large",
      "xl",
    ]);

    await Promise.all([
      workers.getAll().map((worker) => {
        worker.client.debugInformation.clearAllStatistics();
      }),
    ]);

    // Generate comprehensive summary table
    console.log("\n=== COMPREHENSIVE STORAGE & PERFORMANCE SUMMARY ===");
    console.log(
      "| Inbox Size | Sync Time (ms) | DB Size (MB) | Existing Groups | queryGroupMessages |",
    );
    console.log(
      "|------------|----------------|--------------|-----------------|------------------|",
    );
    console.log(
      `| Small      | ${performanceMeasurements.small.syncTime}             | ${performanceMeasurements.small.dbSize}            | ${performanceMeasurements.small.existingGroups} | ${performanceMeasurements.small.queryCount} |`,
    );
    console.log(
      `| Medium     | ${performanceMeasurements.medium.syncTime}             | ${performanceMeasurements.medium.dbSize}           | ${performanceMeasurements.medium.existingGroups} | ${performanceMeasurements.medium.queryCount}      |`,
    );
    console.log(
      `| Large      | ${performanceMeasurements.large.syncTime}             | ${performanceMeasurements.large.dbSize}          | ${performanceMeasurements.large.existingGroups} | ${performanceMeasurements.large.queryCount}      |`,
    );
    console.log(
      `| XL         | ${performanceMeasurements.xl.syncTime}             | ${performanceMeasurements.xl.dbSize}          | ${performanceMeasurements.xl.existingGroups} | ${performanceMeasurements.xl.queryCount}      |`,
    );
    console.log("==================================================\n");
  });
});
