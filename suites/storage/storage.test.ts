import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { formatBytes, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
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
const testName = "storage";
loadEnv(testName);

describe(testName, () => {
  setupTestLifecycle({ expect });

  it("should generate storage efficiency table for different group sizes", async () => {
    const results: StorageMetrics[] = [];

    try {
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      for (const memberCount of memberCounts) {
        console.time(`Testing ${memberCount}-member groups...`);
        console.log(`\n🔄 Testing ${memberCount}-member groups...`);

        const name = `sender${randomSuffix}-${memberCount}`;
        const receiverName = `receiver${randomSuffix}-${memberCount}`;
        const workers = await getWorkers(
          [name, receiverName],
          testName,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
        );
        const creator = workers.get(name);
        const receiver = workers.get(receiverName);
        const memberInboxIds = getRandomInboxIds(memberCount - 2); // -1 because creator is included
        let groupCount = 0;
        let installationSize = await creator?.worker.getSQLiteFileSizes();
        let currentTotalSize = installationSize?.dbFile ?? 0;
        while (currentTotalSize < targetSizeMB * 1024 * 1024) {
          const group = await creator?.client.conversations.newGroup([
            ...memberInboxIds,
            receiver?.inboxId as string,
          ]);
          void group?.send("hi");
          groupCount++;
          let senderSizes = await creator?.worker.getSQLiteFileSizes();
          let receiverSizes = await receiver?.worker.getSQLiteFileSizes();
          currentTotalSize =
            (senderSizes?.dbFile ?? 0) - (installationSize?.dbFile ?? 0);
          console.debug(
            `  Created ${groupCount} groups of ${memberCount} members with total size: ${formatBytes(
              currentTotalSize,
            )} and receiver size: ${formatBytes(receiverSizes?.dbFile ?? 0)}`,
          );
        }
        await workers.checkForks();
        const finalSizeMB = currentTotalSize / (1024 * 1024);
        const sizePerGroupMB = finalSizeMB / groupCount;
        const finalReceiverSizes = await receiver?.worker.getSQLiteFileSizes();
        const metrics: StorageMetrics = {
          totalSizeMB: finalSizeMB,
          numberOfGroups: groupCount,
          membersPerGroup: memberCount,
          sizePerGroupMB,
          receiverSizeMB: (finalReceiverSizes?.dbFile ?? 0) / (1024 * 1024),
          costPerMemberMB: (sizePerGroupMB / memberCount) * 1000,
        };

        results.push(metrics);
        console.log(
          `✅ ${memberCount}-member groups: ${groupCount} groups, ${finalSizeMB.toFixed(2)} MB total`,
        );
        console.timeEnd(`Testing ${memberCount}-member groups...`);
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

        output += `\n| ${result.membersPerGroup} members | ${result.numberOfGroups} | ${result.totalSizeMB.toFixed(1)} MB | ${result.sizePerGroupMB.toFixed(3)} MB | ${result.receiverSizeMB.toFixed(3)} MB | ${efficiencyGain} |`;
      }
      output += "\n\n" + "=".repeat(80);
      console.log(output);
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
