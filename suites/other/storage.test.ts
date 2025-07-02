import { formatBytes } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

interface StorageMetrics {
  totalSizeMB: number;
  numberOfGroups: number;
  membersPerGroup: number;
  sizePerGroupMB: number;
  receiverSizeMB: number;
  costPerMemberMB: number;
}

const memberCounts = [2, 10, 50, 100, 150, 200];
const targetSizeMB = 5;

describe("storage", () => {
  setupTestLifecycle({});

  it("should generate storage efficiency table for different group sizes", async () => {
    const results: StorageMetrics[] = [];
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const memberCount = 2;
    const name = `sender${randomSuffix}-${memberCount}`;
    const receiverName = `receiver${randomSuffix}-${memberCount}`;
    const workers = await getWorkers([name, receiverName]);
    // Note: No streams or syncs needed for this test (all were set to None)
    try {
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
          console.debug(
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
      let output = "\n## Detailed Analysis\n";
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
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
