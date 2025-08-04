import { existsSync, mkdirSync, writeFileSync } from "fs";
import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { parseTestName } from "@helpers/vitest";
import { getWorkers, type Worker } from "@workers/manager";
import { type Group } from "version-management/client-versions";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";

interface SummaryTableConfig {
  groupBy?: string; // regex pattern to extract grouping key (e.g., iteration number)
  sortBy?: "testName" | "duration";
}

interface TestResult {
  testName: string;
  duration: number;
  iteration?: string;
  timestamp: number;
}

// Global summary tracking
const summaryResults = new Map<string, TestResult[]>();

export const setupSummaryTable = ({
  testName,
  getCustomDuration,
  setCustomDuration,
  createSummaryTable = false,
  summaryTableConfig = {},
}: {
  testName: string;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
  createSummaryTable?: boolean;
  summaryTableConfig?: SummaryTableConfig;
}) => {
  let start: number;
  beforeAll(() => {
    loadEnv(testName);
  });
  beforeEach(() => {
    start = performance.now();
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    console.log(currentTestName);

    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(function () {
    const currentTestName = expect.getState().currentTestName ?? "";

    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    // Collect results for summary table
    if (createSummaryTable) {
      const iteration = extractIteration(
        currentTestName,
        summaryTableConfig.groupBy,
      );
      const baseTestName = cleanTestName(
        currentTestName,
        summaryTableConfig.groupBy,
      );

      const result: TestResult = {
        testName: baseTestName,
        duration,
        iteration,
        timestamp: Date.now(),
      };

      const key = `${testName}-${baseTestName}`;
      if (!summaryResults.has(key)) {
        summaryResults.set(key, []);
      }
      const existingResults = summaryResults.get(key);
      if (existingResults) {
        existingResults.push(result);
      }
    }

    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(() => {
    // Display and save summary table if enabled
    if (createSummaryTable) {
      displaySummaryTable(testName);
      saveSummaryTableToMarkdown(testName);
    }
  });
};

// Helper functions for summary table
function extractIteration(testName: string, groupByPattern?: string): string {
  if (!groupByPattern) {
    // Default pattern to extract numbers in parentheses like "create(1000)"
    const match = testName.match(/\((\d+)\)/);
    return match ? match[1] : "0"; // Default to "0" instead of "unknown"
  }

  const match = testName.match(new RegExp(groupByPattern));
  return match ? match[1] || match[0] : "0"; // Default to "0" instead of "unknown"
}

function cleanTestName(testName: string, groupByPattern?: string): string {
  if (!groupByPattern) {
    // Default: extract just the base test name without iteration numbers
    const baseName = testName
      .replace(/\(\d+\)/, "")
      .replace(/:\s*$/, "")
      .trim();
    return baseName;
  }

  // For custom patterns, extract just the base name without the pattern
  const baseName = testName.replace(new RegExp(groupByPattern), "").trim();
  return baseName;
}

// Shared function to process results for both display and markdown
function processResultsForTable(testName: string) {
  const results = Array.from(summaryResults.entries())
    .filter(([key]) => key.startsWith(testName))
    .map(([, results]) => results)
    .flat();

  if (results.length === 0) {
    return null;
  }

  // Group results by test name
  const groupedResults = new Map<string, TestResult[]>();
  results.forEach((result) => {
    const key = result.testName;
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }
    const existingResults = groupedResults.get(key);
    if (existingResults) {
      existingResults.push(result);
    }
  });

  // Get all unique iterations and sort them
  const allIterations = Array.from(new Set(results.map((r) => r.iteration)))
    .filter((iter) => iter !== undefined)
    .sort((a, b) => {
      const numA = parseInt(a || "0");
      const numB = parseInt(b || "0");
      return numA - numB;
    });

  // Create header
  const header = [
    "Operation",
    ...allIterations.map((iter) => (iter === "0" ? "Base" : iter)),
  ];
  header.push("Min", "Max", "Orders");

  // Keep original test order - don't sort
  const sortedTests = Array.from(groupedResults.entries()).map(
    ([testName, results]) => {
      // Parse the test name to get operationName-members format
      const { operationName, members } = parseTestName(testName);
      const displayName = members
        ? `${operationName}-${members}`
        : operationName;
      return [displayName, results] as [string, TestResult[]];
    },
  );

  return {
    groupedResults,
    allIterations,
    header,
    sortedTests,
  };
}

function displaySummaryTable(testName: string): void {
  const tableData = processResultsForTable(testName);

  if (!tableData) {
    console.log("\n📊 No results collected for summary table");
    return;
  }

  const { groupedResults, allIterations, header, sortedTests } = tableData;

  console.log("\n");

  // Calculate proper column widths based on actual data
  const testNames = Array.from(groupedResults.keys());
  const maxTestNameLength = Math.max(
    ...testNames.map((name) => name.length),
    header[0].length,
  );

  // Calculate max width needed for each iteration column
  const iterationColWidths = allIterations.map((iteration, index) => {
    const maxValueLength = Math.max(
      ...Array.from(groupedResults.values()).map((testResults) => {
        const result = testResults.find((r) => r.iteration === iteration);
        return result ? Math.round(result.duration).toString().length : 1;
      }),
      header[index + 1].length,
    );
    return Math.max(maxValueLength, 6); // minimum 6 chars
  });

  const colWidths = [
    Math.min(maxTestNameLength + 2, 35), // Test name column (max 35 chars)
    ...iterationColWidths,
  ];

  colWidths.push(6, 6, 6); // Min, Max, Avg columns

  // Print header
  const headerRow = header
    .map((h, i) => {
      if (i === 0) {
        return h.padEnd(colWidths[i]);
      }
      return h.padStart(colWidths[i]); // Right-align numbers
    })
    .join(" │ ");

  console.log("┌─" + colWidths.map((w) => "─".repeat(w)).join("─┬─") + "─┐");
  console.log("│ " + headerRow + " │");
  console.log("├─" + colWidths.map((w) => "─".repeat(w)).join("─┼─") + "─┤");

  // Print rows
  sortedTests.forEach(([testName, testResults]) => {
    // Use the test name directly since it's already cleaned
    const row = [testName.padEnd(colWidths[0])];

    // Add duration for each iteration
    allIterations.forEach((iteration, i) => {
      const result = testResults.find((r) => r.iteration === iteration);
      const duration = result ? Math.round(result.duration).toString() : "-";
      row.push(duration.padStart(colWidths[i + 1])); // Right-align numbers
    });

    // Add stats if enabled
    if (testResults.length > 0) {
      const durations = testResults.map((r) => r.duration);
      const min = Math.round(Math.min(...durations)).toString();
      const max = Math.round(Math.max(...durations)).toString();

      // Calculate ratio between min and max
      const minVal = Math.min(...durations);
      const maxVal = Math.max(...durations);
      const ratio = minVal > 0 ? maxVal / minVal : 1;
      const orders = ratio === 1 ? "1x" : `${Math.round(ratio)}x`;

      row.push(min.padStart(colWidths[colWidths.length - 3]));
      row.push(max.padStart(colWidths[colWidths.length - 2]));
      row.push(orders.padStart(colWidths[colWidths.length - 1]));
    }

    console.log("│ " + row.join(" │ ") + " │");
  });
}

function saveSummaryTableToMarkdown(testName: string): void {
  const tableData = processResultsForTable(testName);

  if (!tableData) {
    return;
  }

  const { allIterations, header, sortedTests } = tableData;

  // Create markdown content
  const outputFile = "logs/" + testName + getTime() + ".md";

  let markdown = "";

  // Create markdown table
  markdown += "| " + header.join(" | ") + " |\n";
  markdown += "| " + header.map(() => "---").join(" | ") + " |\n";

  // Add rows
  sortedTests.forEach(([testName, testResults]) => {
    // Use the test name directly since it's already cleaned
    const row = [testName];

    // Add duration for each iteration
    allIterations.forEach((iteration) => {
      const result = testResults.find((r) => r.iteration === iteration);
      const duration = result ? Math.round(result.duration).toString() : "-";
      row.push(duration);
    });

    // Add stats if enabled
    if (testResults.length > 0) {
      const durations = testResults.map((r) => r.duration);
      const min = Math.round(Math.min(...durations)).toString();
      const max = Math.round(Math.max(...durations)).toString();

      // Calculate ratio between min and max
      const minVal = Math.min(...durations);
      const maxVal = Math.max(...durations);
      const ratio = minVal > 0 ? maxVal / minVal : 1;
      const orders = ratio === 1 ? "1x" : `${Math.round(ratio)}x`;

      row.push(min, max, orders);
    }

    markdown += "| " + row.join(" | ") + " |\n";
  });

  // Save to file
  try {
    // Ensure the directory exists
    const dir = outputFile.substring(0, outputFile.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputFile, markdown, "utf8");
    console.log(`📄 Results saved to: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to save results to ${outputFile}:`, error);
  }
}

export async function getReceiverGroup(
  receiver: Worker,
  groupId: string,
): Promise<Group> {
  // Sync all conversations first
  await receiver.client.conversations.syncAll();

  // Get the group by receiver with retry logic
  let groupByReceiver: Group | undefined;
  let retryCount = 0;
  const maxRetries = 3;

  while (!groupByReceiver && retryCount < maxRetries) {
    try {
      groupByReceiver =
        (await receiver.client.conversations.getConversationById(
          groupId,
        )) as Group;

      if (groupByReceiver) {
        break;
      }
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
    }
    retryCount++;
    if (retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
    }
  }

  if (!groupByReceiver) {
    throw new Error(
      `Failed to get group ${groupId} after ${maxRetries} attempts`,
    );
  }

  // Sync the specific group
  await groupByReceiver.sync();

  return groupByReceiver;
}
