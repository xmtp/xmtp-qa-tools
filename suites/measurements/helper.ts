import { writeFileSync } from "fs";
import { parseTestName } from "@helpers/vitest";
import { afterAll, afterEach, beforeEach, expect } from "vitest";

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
  beforeEach(() => {
    start = performance.now();
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(function () {
    const currentTestName = expect.getState().currentTestName ?? "";
    console.log(currentTestName);
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
      displaySummaryTable(testName, summaryTableConfig);
      saveSummaryTableToMarkdown(testName, summaryTableConfig);
    }
  });
};

// Helper functions for summary table
function extractIteration(testName: string, groupByPattern?: string): string {
  if (!groupByPattern) {
    // Default pattern to extract numbers in parentheses like "create(1000)"
    const match = testName.match(/\((\d+)\)/);
    return match ? match[1] : "unknown";
  }

  const match = testName.match(new RegExp(groupByPattern));
  return match ? match[1] || match[0] : "unknown";
}

function cleanTestName(testName: string, groupByPattern?: string): string {
  if (!groupByPattern) {
    // Default: extract iteration numbers in parentheses and append to test name
    const match = testName.match(/\((\d+)\)/);
    const baseName = testName
      .replace(/\(\d+\)/, "")
      .replace(/:\s*$/, "")
      .trim();

    if (match) {
      return `${baseName}-${match[1]}`;
    }
    return baseName;
  }

  // For custom patterns, extract the group size and append it
  const match = testName.match(new RegExp(groupByPattern));
  const baseName = testName.replace(new RegExp(groupByPattern), "").trim();

  if (match) {
    const groupSize = match[1] || match[0];
    return `${baseName}-${groupSize}`;
  }
  return baseName;
}

function displaySummaryTable(
  testName: string,
  config: SummaryTableConfig,
): void {
  const results = Array.from(summaryResults.entries())
    .filter(([key]) => key.startsWith(testName))
    .map(([, results]) => results)
    .flat();

  if (results.length === 0) {
    console.log("\n📊 No results collected for summary table");
    return;
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

  console.log("\n");
  console.log(
    "┌─────────────────────────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│                           📊 Performance Test Summary                           │",
  );
  console.log(
    "└─────────────────────────────────────────────────────────────────────────────────┘",
  );

  // Create header with cleaner labels
  const header = [
    "Test",
    ...allIterations.map((iter) => (iter === "0" ? "Base" : iter)),
  ];
  header.push("Min", "Max", "Avg");

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

  // Sort test results
  const sortedTests = Array.from(groupedResults.entries()).sort(([a], [b]) => {
    if (config.sortBy === "duration") {
      const resultsA = groupedResults.get(a);
      const resultsB = groupedResults.get(b);
      if (resultsA && resultsB) {
        const avgA =
          resultsA.reduce((sum, r) => sum + r.duration, 0) / resultsA.length;
        const avgB =
          resultsB.reduce((sum, r) => sum + r.duration, 0) / resultsB.length;
        return avgA - avgB;
      }
    }
    return a.localeCompare(b);
  });

  // Print rows
  sortedTests.forEach(([testName, testResults]) => {
    // Truncate test name if too long
    const { operationName, members } = parseTestName(testName);

    const row = [operationName + "-" + members.padEnd(colWidths[0])];

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
      const avg = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length,
      ).toString();

      row.push(min.padStart(colWidths[colWidths.length - 3]));
      row.push(max.padStart(colWidths[colWidths.length - 2]));
      row.push(avg.padStart(colWidths[colWidths.length - 1]));
    }

    console.log("│ " + row.join(" │ ") + " │");
  });

  console.log("└─" + colWidths.map((w) => "─".repeat(w)).join("─┴─") + "─┘");
  console.log(
    `📈 Summary: ${groupedResults.size} tests across ${allIterations.length} iterations\n`,
  );
}

function saveSummaryTableToMarkdown(
  testName: string,
  config: SummaryTableConfig,
): void {
  const results = Array.from(summaryResults.entries())
    .filter(([key]) => key.startsWith(testName))
    .map(([, results]) => results)
    .flat();

  if (results.length === 0) {
    return;
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

  // Create markdown content
  const outputFile = testName + ".md";
  const timestamp = new Date().toISOString();

  let markdown = `# Performance Test Results: ${testName}\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `**Summary:** ${groupedResults.size} tests across ${allIterations.length} iterations\n\n`;

  // Create header
  const header = [
    "Test",
    ...allIterations.map((iter) => (iter === "0" ? "Base" : iter)),
  ];
  header.push("Min", "Max", "Avg");

  // Create markdown table
  markdown += "| " + header.join(" | ") + " |\n";
  markdown += "| " + header.map(() => "---").join(" | ") + " |\n";

  // Sort test results
  const sortedTests = Array.from(groupedResults.entries()).sort(([a], [b]) => {
    if (config.sortBy === "duration") {
      const resultsA = groupedResults.get(a);
      const resultsB = groupedResults.get(b);
      if (resultsA && resultsB) {
        const avgA =
          resultsA.reduce((sum, r) => sum + r.duration, 0) / resultsA.length;
        const avgB =
          resultsB.reduce((sum, r) => sum + r.duration, 0) / resultsB.length;
        return avgA - avgB;
      }
    }
    return a.localeCompare(b);
  });

  // Add rows
  sortedTests.forEach(([testName, testResults]) => {
    const { operationName, members } = parseTestName(testName);
    const row = [operationName + "-" + members];

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
      const avg = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length,
      ).toString();

      row.push(min, max, avg);
    }

    markdown += "| " + row.join(" | ") + " |\n";
  });

  // Save to file
  try {
    writeFileSync(outputFile, markdown, "utf8");
    console.log(`📄 Results saved to: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to save results to ${outputFile}:`, error);
  }
}
