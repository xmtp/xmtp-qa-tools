import fs from "fs";
import path from "path";
import { getThresholdForOperation } from "./calculations";

/**
 * Logs a summary of all collected metrics against their thresholds
 * Call this at the end of test execution
 */
export function logMetricsSummary(
  testName: string,
  currentGeo: string,
  isInitialized: boolean,
  collectedMetrics: Record<
    string,
    {
      values: number[];
      threshold: number;
      members?: string;
    }
  >,
  batchSize?: number,
): void {
  if (!isInitialized || Object.keys(collectedMetrics).length === 0) {
    console.log("No metrics collected to summarize");
    return;
  }

  console.log("\n📊 Creating metrics summary report");

  // ADD THIS: Log the raw collected metrics to see what's actually there
  console.log(
    "RAW COLLECTED METRICS:",
    JSON.stringify(collectedMetrics, null, 2),
  );

  // Create a simple text summary for the console
  const passedMetrics = Object.entries(collectedMetrics).filter(
    ([operation, data]) => {
      // Skip workflow metrics when counting passed metrics
      if (operation === "workflow") return false;

      if (data.values.length === 0) return false;
      const average =
        data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
      return average <= data.threshold;
    },
  ).length;

  // Count only non-workflow metrics for total
  const totalMetrics = Object.entries(collectedMetrics).filter(
    ([operation]) => operation !== "workflow",
  ).length;

  console.log(
    `✅ Passed: ${passedMetrics}/${totalMetrics} metrics (${Math.round((passedMetrics / totalMetrics) * 100)}%)`,
  );

  // Create a directory for reports if it doesn't exist
  const reportsDir = path.join(process.cwd(), "logs/reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(
    reportsDir,
    `${testName}-${currentGeo}-${process.env.XMTP_ENV}.md`,
  );

  // Build the table content
  let fileContent = "METRICS SUMMARY\n===============\n\n";
  fileContent +=
    "Operation | Members | Avg (ms) | Min/Max (ms) | Threshold (ms) | Variance (ms) | Status\n";
  fileContent +=
    "----------|---------|----------|--------------|----------------|---------------|-------\n";

  // Group metrics by base operation name to associate network times with operations
  const operationGroups = new Map();

  // First pass - group and organize data
  for (const [operation, data] of Object.entries(collectedMetrics)) {
    // Skip workflow metrics in the summary table
    if (operation === "workflow") continue;
    if (data.values.length === 0) continue;

    // Look for operation-members format (e.g., "createGroup-10")
    const dashMatch = operation.match(/^([a-zA-Z]+)-(\d+)$/);
    const operationName = dashMatch ? dashMatch[1] : operation.split(":")[0];
    const memberCount = dashMatch ? dashMatch[2] : data.members || "-";

    // Create a unique key for each operation + member count combination
    const groupKey = `${operationName}-${memberCount}`;

    console.log(
      `Processing metric: ${operation} → ${groupKey} (Members: ${memberCount})`,
    );

    if (!operationGroups.has(groupKey)) {
      operationGroups.set(groupKey, {
        operationName: operationName,
        members: memberCount,
        operationData: null,
      });
    }

    const group = operationGroups.get(groupKey);

    group.operationData = data;
  }

  // Second pass - generate table rows
  for (const [groupKey, group] of operationGroups.entries()) {
    if (!group.operationData) continue;

    const data = group.operationData;
    const operationName = group.operationName;

    // Use the member count preserved in the group
    const memberCount =
      group.members !== "-" ? parseInt(group.members as string) : 10;

    console.log(
      `Calculating threshold for ${operationName} with ${memberCount} members`,
    );

    // Recalculate threshold with correct values
    const calculatedThreshold = getThresholdForOperation(
      operationName as string,
      operationName.toLowerCase().includes("-") ? "group" : "core",
      group.members as string,
      currentGeo,
    );

    // Update the threshold in the data
    data.threshold = calculatedThreshold;
    console.debug(data.threshold);
    const average =
      data.values.reduce((sum: number, val: number) => sum + val, 0) /
      data.values.length;
    const min = Math.min(...(data.values as number[]));
    const max = Math.max(...(data.values as number[]));

    const status = average <= data.threshold ? "PASS ✅" : "FAIL ❌";

    // Calculate variance between average and threshold
    const variance = Math.round(average - data.threshold);
    const varianceFormatted =
      variance <= 0 ? variance.toString() : `+${variance}`;

    console.debug("getThresholdForOperation inputs:", {
      operationName,
      operationType: operationName.includes("-") ? "group" : "core",
      memberCountStr: group.members,
      currentGeo,
      batchSize,
      actualMemberCount: memberCount,
    });

    fileContent += `${operationName} | ${group.members} | ${Math.round(average)} | ${Math.round(min)}/${Math.round(max)} | ${data.threshold} | ${varianceFormatted} | ${status}\n`;
  }

  // Write to file
  try {
    fs.writeFileSync(filename, fileContent);
    console.log(`📝 Metrics summary written to: ${filename}`);
  } catch (error) {
    console.error(`❌ Error writing metrics summary to file:`, error);
  }

  // Reset metrics collection for next test run
  collectedMetrics = {};
}
