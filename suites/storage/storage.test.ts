import { getWorkers } from "@workers/manager";
import { loadEnv } from "dev/helpers/client";
import { logError } from "dev/helpers/logger";
import { formatBytes, getRandomInboxIds } from "dev/helpers/utils";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { describe, expect, it } from "vitest";

interface StorageMetrics {
  totalSizeMB: number;
  numberOfGroups: number;
  membersPerGroup: number;
  sizePerGroupMB: number;
  costPerMemberMB: number;
}

const memberCounts = [2, 10, 50, 100];
const targetSizeMB = 50;
const timeOut = 300000000;
const testName = "storage";
loadEnv(testName);

describe(
  testName,
  () => {
    setupTestLifecycle({ expect });

    it("should generate storage efficiency table for different group sizes", async () => {
      const results: StorageMetrics[] = [];

      try {
        for (const memberCount of memberCounts) {
          console.log(`\n🔄 Testing ${memberCount}-member groups...`);

          const name = `fabri-${memberCount}`;
          const workers = await getWorkers([name], testName);
          const creator = workers.get(name);

          const memberInboxIds = getRandomInboxIds(memberCount - 1); // -1 because creator is included
          let groupCount = 0;
          let currentTotalSize = await creator?.worker.getSQLiteFileSizes();

          while (
            currentTotalSize?.total &&
            currentTotalSize.total < targetSizeMB * 1024 * 1024
          ) {
            await creator?.client.conversations.newGroup(memberInboxIds);
            groupCount++;
            currentTotalSize = await creator?.worker.getSQLiteFileSizes();

            // Log progress every 10 groups for larger group sizes, every 100 for smaller
            const logInterval = memberCount >= 50 ? 10 : 100;
            if (groupCount % logInterval === 0) {
              console.log(
                `  Created ${groupCount} groups, size: ${formatBytes(currentTotalSize?.total ?? 0)}`,
              );
            }
          }

          const finalSizeMB = (currentTotalSize?.total ?? 0) / (1024 * 1024);
          const sizePerGroupMB = finalSizeMB / groupCount;
          const costPerMemberMB = sizePerGroupMB / memberCount;

          const metrics: StorageMetrics = {
            totalSizeMB: finalSizeMB,
            numberOfGroups: groupCount,
            membersPerGroup: memberCount,
            sizePerGroupMB,
            costPerMemberMB,
          };

          results.push(metrics);

          console.log(
            `✅ ${memberCount}-member groups: ${groupCount} groups, ${finalSizeMB.toFixed(2)} MB total`,
          );
        }

        // Generate and display the efficiency table
        console.log("\n" + "=".repeat(80));
        console.log("📊 STORAGE EFFICIENCY ANALYSIS");
        console.log("=".repeat(80));

        console.log("\n## Storage Efficiency by Group Size");
        console.log(
          "| Total Size | Number of Groups | Members per Group | Size per Group (MB) | Cost per Member (MB) |",
        );
        console.log(
          "|------------|------------------|-------------------|--------------------|--------------------|",
        );

        for (const result of results) {
          console.log(
            `| ${result.totalSizeMB.toFixed(0)} MB      | ${result.numberOfGroups.toLocaleString()}           | ${result.membersPerGroup}                 | ${result.sizePerGroupMB.toFixed(6)}           | ${result.costPerMemberMB.toFixed(6)}          |`,
          );
        }

        // Calculate and display efficiency insights
        const baseline = results[0]; // 2-member groups as baseline
        console.log("\n*Key insights:");

        for (let i = 1; i < results.length; i++) {
          const current = results[i];
          const efficiency = baseline.costPerMemberMB / current.costPerMemberMB;
          console.log(
            `${current.membersPerGroup}-member groups are ${efficiency.toFixed(1)}x more efficient than ${baseline.membersPerGroup}-member groups.`,
          );
        }

        // Compare adjacent group sizes
        for (let i = 1; i < results.length; i++) {
          const current = results[i];
          const previous = results[i - 1];
          const efficiency = previous.costPerMemberMB / current.costPerMemberMB;
          console.log(
            `${current.membersPerGroup}-member groups are ${efficiency.toFixed(1)}x more efficient than ${previous.membersPerGroup}-member groups.`,
          );
        }
        console.log("\n" + "=".repeat(80));

        // Verify we have results for all member counts
        expect(results).toHaveLength(memberCounts.length);
        expect(results.every((r) => r.totalSizeMB >= targetSizeMB * 0.9)).toBe(
          true,
        ); // Allow 10% under target
      } catch (e) {
        logError(e, expect.getState().currentTestName || "unknown test");
        throw e;
      }
    });
  },
  timeOut,
);
