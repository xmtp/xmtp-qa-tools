import { writeFileSync } from "fs";
import { parseTestName } from "../../helpers/datadog";

export interface SummaryTableConfig {
  groupBy?: string; // regex pattern to extract grouping key (e.g., iteration number)
  showStats?: boolean; // show min/max/avg columns
  sortBy?: "testName" | "duration";
  saveToFile?: boolean;
}

export interface TestResult {
  testName: string;
  duration: number;
  iteration?: string;
  timestamp: number;
}

// Global summary tracking
const summaryResults = new Map<string, TestResult[]>();

// Helper functions for summary table
export function extractIteration(
  testName: string,
  groupByPattern?: string,
): string {
  if (!groupByPattern) {
    // Default pattern to extract numbers in parentheses like "create(1000)"
    const match = testName.match(/\((\d+)\)/);
    return match ? match[1] : "unknown";
  }

  const match = testName.match(new RegExp(groupByPattern));
  return match ? match[1] || match[0] : "unknown";
}

export function cleanTestName(
  testName: string,
  groupByPattern?: string,
): string {
  if (!groupByPattern) {
    // Default: remove iteration numbers in parentheses
    return testName
      .replace(/\(\d+\)/, "")
      .replace(/:\s*$/, "")
      .trim();
  }

  return testName.replace(new RegExp(groupByPattern), "").trim();
}

export function addTestResult(
  testName: string,
  baseTestName: string,
  duration: number,
  iteration?: string,
): void {
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

export function displaySummaryTable(
  testName: string,
  config: SummaryTableConfig,
  saveToFile?: boolean,
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

  const summaryTable = [];

  // Create header with cleaner labels
  const header = [
    "Test",
    ...allIterations.map((iter) => (iter === "0" ? "Base" : iter)),
  ];
  if (config.showStats) {
    header.push("Min", "Max", "Avg");
  }

  // Add header to summary table for file export
  summaryTable.push(header);

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

  if (config.showStats) {
    colWidths.push(6, 6, 6); // Min, Max, Avg columns
  }

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
    const truncatedTestName = parseTestName(testName).operationName;

    const row = [truncatedTestName.padEnd(colWidths[0])];

    // Add duration for each iteration
    allIterations.forEach((iteration, i) => {
      const result = testResults.find((r) => r.iteration === iteration);
      const duration = result ? Math.round(result.duration).toString() : "-";
      row.push(duration.padStart(colWidths[i + 1])); // Right-align numbers
    });

    // Add stats if enabled
    if (config.showStats && testResults.length > 0) {
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

    // Add row data to summary table for file export (without padding)
    const fileRow = [truncatedTestName];
    allIterations.forEach((iteration) => {
      const result = testResults.find((r) => r.iteration === iteration);
      const duration = result ? Math.round(result.duration).toString() : "-";
      fileRow.push(duration);
    });

    if (config.showStats && testResults.length > 0) {
      const durations = testResults.map((r) => r.duration);
      const min = Math.round(Math.min(...durations)).toString();
      const max = Math.round(Math.max(...durations)).toString();
      const avg = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length,
      ).toString();

      fileRow.push(min, max, avg);
    }

    summaryTable.push(fileRow);
  });

  console.log("└─" + colWidths.map((w) => "─".repeat(w)).join("─┴─") + "─┘");
  console.log(
    `📈 Summary: ${groupedResults.size} tests across ${allIterations.length} iterations\n`,
  );

  // Save summary table to file if requested
  if (saveToFile && summaryTable.length > 0) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `summaryTable-${testName}-${timestamp}.json`;

      // Convert table to JSON format
      const tableData = {
        testName,
        timestamp: new Date().toISOString(),
        summary: `${groupedResults.size} tests across ${allIterations.length} iterations`,
        data: summaryTable,
      };

      writeFileSync(filename, JSON.stringify(tableData, null, 2));
      console.log(`💾 Summary table saved to: ${filename}`);
    } catch (error) {
      console.error("❌ Failed to save summary table to file:", error);
    }
  }
}
