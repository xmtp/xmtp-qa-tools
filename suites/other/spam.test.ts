import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { formatBytes, getManualUsers } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "spam";
loadEnv(testName);

// Configuration - Target storage in MB
const TARGET_STORAGE_MB = 100;

// Initial estimate based on storage analysis: Group creation costs ~732KB per group
// But we suspect logarithmic efficiency, so this will likely be much higher
const INITIAL_GROUP_COST_KB = 732;
const ESTIMATED_GROUPS = Math.ceil(
  (TARGET_STORAGE_MB * 1024) / INITIAL_GROUP_COST_KB,
);

interface EfficiencyMeasurement {
  groupCount: number;
  totalStorageBytes: number;
  storageIncreaseBytes: number;
  avgCostPerGroupBytes: number;
  marginalCostBytes: number;
  efficiencyRatio: number;
}

const timeout = 300000000;
describe(testName, () => {
  let workers: WorkerManager;

  setupTestLifecycle({ expect });

  it(
    `should test logarithmic efficiency pattern in group storage (target: ${TARGET_STORAGE_MB}MB)`,
    async () => {
      try {
        const receiver = getManualUsers(["fabri-tba"]);
        console.log(JSON.stringify(receiver, null, 2));

        workers = await getWorkers(
          ["bot"],
          testName,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
          receiver[0].network as "production" | "dev" | "local",
        );

        console.log(
          `🎯 Target: ${TARGET_STORAGE_MB}MB storage to test logarithmic efficiency`,
        );
        console.log(
          `📊 Initial estimate: ${ESTIMATED_GROUPS} groups (based on ${INITIAL_GROUP_COST_KB}KB per group)`,
        );

        // Measure initial storage
        const initialSize =
          workers.get("bot")?.worker.getSQLiteFileSizes().dbFile ?? 0;
        console.log(`📏 Initial storage: ${formatBytes(initialSize)}`);

        let groupsCreated = 0;
        const TARGET_BYTES = TARGET_STORAGE_MB * 1024 * 1024;
        let currentSize = initialSize;
        let previousSize = initialSize;
        const measurements: EfficiencyMeasurement[] = [];

        // Measure at more frequent intervals to capture logarithmic pattern
        const measurementIntervals = [
          1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500,
          750, 1000,
        ];
        let nextMeasurementIndex = 0;

        while (
          currentSize - initialSize < TARGET_BYTES &&
          groupsCreated < ESTIMATED_GROUPS * 3
        ) {
          const group = await workers
            .get("bot")
            ?.client.conversations.newGroup([receiver[0].inboxId], {
              groupName: `Efficiency Test Group ${groupsCreated + 1}`,
              groupDescription: `Group ${groupsCreated + 1} for logarithmic efficiency analysis`,
            });

          if (!group) {
            throw new Error("Failed to create group");
          }

          await group.send(
            `Efficiency test message for group ${groupsCreated + 1}`,
          );
          groupsCreated++;

          // Check if we should measure at this interval
          if (
            nextMeasurementIndex < measurementIntervals.length &&
            groupsCreated === measurementIntervals[nextMeasurementIndex]
          ) {
            currentSize =
              workers.get("bot")?.worker.getSQLiteFileSizes().dbFile ?? 0;
            const totalStorageIncrease = currentSize - initialSize;
            const storageIncreaseSinceLastMeasurement =
              currentSize - previousSize;
            const avgCostPerGroup = totalStorageIncrease / groupsCreated;

            // Calculate marginal cost (cost of groups since last measurement)
            const groupsSinceLastMeasurement =
              nextMeasurementIndex === 0
                ? groupsCreated
                : groupsCreated -
                  measurementIntervals[nextMeasurementIndex - 1];
            const marginalCost =
              groupsSinceLastMeasurement > 0
                ? storageIncreaseSinceLastMeasurement /
                  groupsSinceLastMeasurement
                : 0;

            // Calculate efficiency ratio (how much more efficient compared to initial estimate)
            const efficiencyRatio =
              (INITIAL_GROUP_COST_KB * 1024) / avgCostPerGroup;

            const measurement: EfficiencyMeasurement = {
              groupCount: groupsCreated,
              totalStorageBytes: totalStorageIncrease,
              storageIncreaseBytes: storageIncreaseSinceLastMeasurement,
              avgCostPerGroupBytes: avgCostPerGroup,
              marginalCostBytes: marginalCost,
              efficiencyRatio: efficiencyRatio,
            };

            measurements.push(measurement);

            console.log(
              `📊 [${groupsCreated} groups] Total: ${formatBytes(totalStorageIncrease)} | Avg: ${formatBytes(avgCostPerGroup)}/group | Marginal: ${formatBytes(marginalCost)}/group | Efficiency: ${efficiencyRatio.toFixed(2)}x`,
            );

            previousSize = currentSize;
            nextMeasurementIndex++;

            if (totalStorageIncrease >= TARGET_BYTES) {
              console.log(
                `🎉 Target reached! ${formatBytes(totalStorageIncrease)} >= ${formatBytes(TARGET_BYTES)}`,
              );
              break;
            }
          }
        }

        // Final measurement and analysis
        const finalSize =
          workers.get("bot")?.worker.getSQLiteFileSizes().dbFile ?? 0;
        const totalStorageIncrease = finalSize - initialSize;
        const finalAvgPerGroup = totalStorageIncrease / groupsCreated;

        console.log(`
🔬 LOGARITHMIC EFFICIENCY ANALYSIS
=================================
📊 Target: ${formatBytes(TARGET_BYTES)}
📈 Actual: ${formatBytes(totalStorageIncrease)}
📦 Groups Created: ${groupsCreated}
📏 Final Avg: ${formatBytes(finalAvgPerGroup)}/group
📐 Initial Estimate: ${formatBytes(INITIAL_GROUP_COST_KB * 1024)}/group
✨ Total Efficiency Gain: ${((INITIAL_GROUP_COST_KB * 1024) / finalAvgPerGroup).toFixed(2)}x

📈 EFFICIENCY CURVE ANALYSIS
============================`);

        measurements.forEach((m, index) => {
          const trend =
            index > 0
              ? m.avgCostPerGroupBytes <
                measurements[index - 1].avgCostPerGroupBytes
                ? "↓"
                : "↑"
              : "-";
          console.log(
            `${String(m.groupCount).padStart(4)} groups: ${formatBytes(m.avgCostPerGroupBytes).padStart(10)}/group ${trend} (${m.efficiencyRatio.toFixed(2)}x efficiency)`,
          );
        });

        // Test logarithmic efficiency hypothesis
        if (measurements.length >= 3) {
          const firstMeasurement = measurements[0];
          const lastMeasurement = measurements[measurements.length - 1];
          const efficiencyImprovement =
            firstMeasurement.avgCostPerGroupBytes /
            lastMeasurement.avgCostPerGroupBytes;

          console.log(`
🧮 LOGARITHMIC HYPOTHESIS TEST
============================
• First measurement (${firstMeasurement.groupCount} groups): ${formatBytes(firstMeasurement.avgCostPerGroupBytes)}/group
• Last measurement (${lastMeasurement.groupCount} groups): ${formatBytes(lastMeasurement.avgCostPerGroupBytes)}/group
• Efficiency improvement: ${efficiencyImprovement.toFixed(2)}x
• Pattern: ${efficiencyImprovement > 1.5 ? "✅ Logarithmic efficiency confirmed" : "❌ Linear pattern detected"}
          `);

          expect(efficiencyImprovement).toBeGreaterThan(1.1); // At least 10% efficiency gain
          expect(groupsCreated).toBeGreaterThan(0);
          expect(totalStorageIncrease).toBeGreaterThan(0);
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    },
    timeout,
  );
});
