import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { formatBytes, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
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
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        for (const memberCount of memberCounts) {
          console.time(`Testing ${memberCount}-member groups...`);
          console.log(`\n🔄 Testing ${memberCount}-member groups...`);

          const name = `sender${randomSuffix}-${memberCount}`;
          const receiverName = `receiver${randomSuffix}-${memberCount}`;
          const workers = await getWorkers([name, receiverName], testName);
          const creator = workers.get(name);
          const receiver = workers.get(receiverName);

          const memberInboxIds = getRandomInboxIds(memberCount - 2); // -1 because creator is included
          let groupCount = 0;
          let currentTotalSize = await creator?.worker.getSQLiteFileSizes();

          while (
            currentTotalSize?.dbFile &&
            currentTotalSize.dbFile < targetSizeMB * 1024 * 1024
          ) {
            await creator?.client.conversations.newGroup([
              ...memberInboxIds,
              receiver?.inboxId as string,
            ]);
            //await group?.send("hi");
            groupCount++;
            currentTotalSize = await creator?.worker.getSQLiteFileSizes();
            console.debug(
              `  Created ${groupCount} groups of ${memberCount} members with total size: ${formatBytes(
                currentTotalSize?.dbFile as number,
              )}`,
            );
          }

          const finalSizeMB = (currentTotalSize?.dbFile ?? 0) / (1024 * 1024);
          const sizePerGroupMB = finalSizeMB / groupCount;
          const costPerMemberMB = sizePerGroupMB / memberCount;
          await receiver?.client.conversations.syncAll();
          await creator?.client.conversations.syncAll();
          const receiverSizeMB = await receiver?.worker.getSQLiteFileSizes();
          const metrics: StorageMetrics = {
            totalSizeMB: finalSizeMB,
            numberOfGroups: groupCount,
            membersPerGroup: memberCount,
            sizePerGroupMB,
            costPerMemberMB,
            receiverSizeMB: receiverSizeMB?.dbFile ?? 0,
          };

          results.push(metrics);
          console.log(
            `✅ ${memberCount}-member groups: ${groupCount} groups, ${finalSizeMB.toFixed(2)} MB total`,
          );
          console.timeEnd(`Testing ${memberCount}-member groups...`);
        }

        // Build complete output string
        let output = "\n## Storage Efficiency by Group Size\n";
        output +=
          "| Total Size | Number of Groups | Members per Group | Size per Group (MB) | Cost per Member (MB) |\n";
        output +=
          "|------------|------------------|-------------------|--------------------|--------------------|";

        for (const result of results) {
          output += `\n| ${result.totalSizeMB.toFixed(0)} MB      | ${result.numberOfGroups.toLocaleString()}           | ${result.membersPerGroup}                 | ${result.sizePerGroupMB.toFixed(6)}           | ${result.costPerMemberMB.toFixed(6)}          |`;
        }

        // Calculate and display efficiency insights
        const baseline = results[0]; // 2-member groups as baseline
        output += "\n\n*Key insights:";

        for (let i = 1; i < results.length; i++) {
          const current = results[i];
          const efficiency = baseline.costPerMemberMB / current.costPerMemberMB;
          output += `\n${current.membersPerGroup}-member groups are ${efficiency.toFixed(1)}x more efficient than ${baseline.membersPerGroup}-member groups.`;
        }

        output += "\n\n" + "=".repeat(80);

        // Print everything at once
        console.log(output);
      } catch (e) {
        logError(e, expect.getState().currentTestName || "unknown test");
        throw e;
      }
    });
  },
  timeOut,
);
