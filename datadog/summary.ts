import fs from "fs";
import path from "path";
import {
  calculateAverage,
  getThresholdForOperation,
  groupMetricsByOperation,
} from "./slo";

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
): void {
  if (!isInitialized || Object.keys(collectedMetrics).length === 0) {
    console.log("No metrics collected to summarize");
    return;
  }

  console.log("\n📊 Creating metrics summary report");

  // Filter out workflow metrics and empty value arrays
  const validMetrics = Object.entries(collectedMetrics).filter(
    ([operation, data]) => operation !== "workflow" && data.values.length > 0,
  );

  // Count passed metrics
  const passedMetrics = validMetrics.filter(([_, data]) => {
    const average = calculateAverage(data.values);
    return average <= data.threshold;
  }).length;

  const totalMetrics = validMetrics.length;
  const passRate =
    totalMetrics > 0 ? Math.round((passedMetrics / totalMetrics) * 100) : 0;

  console.log(
    `✅ Passed: ${passedMetrics}/${totalMetrics} metrics (${passRate}%)`,
  );

  // Create directory for reports
  const reportsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Create filename with environment info
  const filename = path.join(
    reportsDir,
    `${testName}-${currentGeo}-${process.env.XMTP_ENV}.md`,
  );

  // Generate report content
  const fileContent = generateReportContent(validMetrics, currentGeo);

  try {
    fs.writeFileSync(filename, fileContent);
  } catch (error) {
    console.error(`❌ Error writing metrics summary to file:`, error);
  }

  // Reset metrics collection for next test run
  collectedMetrics = {};
}

/**
 * Generate the markdown report content
 */
function generateReportContent(
  validMetrics: [
    string,
    { values: number[]; threshold: number; members?: string },
  ][],
  currentGeo: string,
): string {
  let content = "METRICS SUMMARY\n===============\n\n";
  content +=
    "Operation | Members | Avg (ms) | Min/Max (ms) | Threshold (ms) | Variance (ms) | Status\n";
  content +=
    "----------|---------|----------|--------------|----------------|---------------|-------\n";

  // Group metrics by operation name and member count
  const operationGroups = groupMetricsByOperation(validMetrics);

  // Generate table rows
  for (const group of operationGroups.values()) {
    if (!group.operationData) continue;

    const { operationName, members, operationData: data } = group;
    const memberCount = members !== "-" ? parseInt(members as string) : 10;
    const operationType = operationName.toLowerCase().includes("-")
      ? "group"
      : "core";

    // Calculate threshold with correct values
    data.threshold = getThresholdForOperation(
      operationName,
      operationType,
      memberCount,
      currentGeo,
    );

    const average = calculateAverage(data.values);
    const min = Math.min(...data.values);
    const max = Math.max(...data.values);
    const status = average <= data.threshold ? "PASS ✅" : "FAIL ❌";

    // Format variance
    const variance = Math.round(average - data.threshold);
    const varianceFormatted =
      variance <= 0 ? variance.toString() : `+${variance}`;

    content += `${operationName} | ${members} | ${Math.round(average)} | ${Math.round(min)}/${Math.round(max)} | ${data.threshold} | ${varianceFormatted} | ${status}\n`;
  }

  return content;
}
