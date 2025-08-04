import { existsSync, mkdirSync, writeFileSync } from "fs";
import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { parseTestName } from "@helpers/vitest";
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
const csvFiles = new Map<string, string>();
const markdownFiles = new Map<string, string>();

export const setupSummaryTable = ({
  testName,
  getCustomDuration,
  setCustomDuration,
  summaryTableConfig = {},
}: {
  testName: string;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
  summaryTableConfig?: SummaryTableConfig;
}) => {
  let start: number;
  beforeAll(() => {
    loadEnv(testName);

    initializeCsvFile(testName);
    initializeMarkdownFile(testName);
  });
  beforeEach(() => {
    start = performance.now();
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    console.debug("Starting test", currentTestName);

    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(function () {
    const currentTestName = expect.getState().currentTestName ?? "";

    console.debug("Ending test", currentTestName);
    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    // Collect results for summary table
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

    // Update table, CSV, and markdown in real-time
    updateTableAndFiles(testName);

    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(() => {
    // Display final summary table if enabled
    displaySummaryTable(testName);
    console.log(`📊 Final results saved to CSV: ${csvFiles.get(testName)}`);

    // Display final markdown table if enabled
    console.log(
      `📄 Final results saved to markdown: ${markdownFiles.get(testName)}`,
    );
  });
};

// Initialize CSV file with headers
function initializeCsvFile(testName: string): void {
  const csvFile = `logs/${testName}${getTime()}.csv`;
  csvFiles.set(testName, csvFile);

  try {
    // Ensure the directory exists
    const dir = csvFile.substring(0, csvFile.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write CSV header (will be updated as we get more data)
    writeFileSync(csvFile, "Operation-Members\n", "utf8");
    console.log(`📄 CSV file initialized: ${csvFile}`);
  } catch (error) {
    console.error(`❌ Failed to initialize CSV file ${csvFile}:`, error);
  }
}

// Initialize markdown file with headers
function initializeMarkdownFile(testName: string): void {
  const markdownFile = `logs/${testName}${getTime()}.md`;
  markdownFiles.set(testName, markdownFile);

  try {
    // Ensure the directory exists
    const dir = markdownFile.substring(0, markdownFile.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write markdown header (will be updated as we get more data)
    writeFileSync(
      markdownFile,
      "| Operation-Members |\n| -------------------- |\n",
      "utf8",
    );
    console.log(`📄 Markdown file initialized: ${markdownFile}`);
  } catch (error) {
    console.error(
      `❌ Failed to initialize markdown file ${markdownFile}:`,
      error,
    );
  }
}

// Update table, CSV, and markdown in real-time
function updateTableAndFiles(testName: string): void {
  const tableData = processResultsForTable(testName);
  if (!tableData) return;

  const { allIterations, header, sortedTests } = tableData;

  // Update CSV file if enabled
  const csvFile = csvFiles.get(testName);
  if (csvFile) {
    try {
      // Update CSV file with current data
      let csvContent = header.join(",") + "\n";

      sortedTests.forEach(([testName, testResults]) => {
        const row = [testName];

        allIterations.forEach((iteration) => {
          const result = testResults.find((r) => r.iteration === iteration);
          let duration = result ? Math.round(result.duration).toString() : "-";

          // Don't add emojis to CSV - keep it clean
          row.push(duration);
        });

        csvContent += row.join(",") + "\n";
      });

      writeFileSync(csvFile, csvContent, "utf8");
    } catch (error) {
      console.error(`❌ Failed to update CSV file ${csvFile}:`, error);
    }
  }

  const markdownFile = markdownFiles.get(testName);
  if (markdownFile) {
    try {
      // Generate markdown table content
      const markdownContent = generateMarkdownTable(tableData);
      writeFileSync(markdownFile, markdownContent, "utf8");
    } catch (error) {
      console.error(
        `❌ Failed to update markdown file ${markdownFile}:`,
        error,
      );
    }
  }

  displaySummaryTable(testName);
}

// Generate markdown table content
function generateMarkdownTable(tableData: {
  allIterations: string[];
  header: string[];
  sortedTests: [string, TestResult[]][];
}): string {
  const { allIterations, header, sortedTests } = tableData;

  // Create header row
  const headerRow = header.join(" | ");
  const separatorRow = header
    .map((h, i) => {
      if (i === 0) {
        return "--------------------";
      }
      return "-------";
    })
    .join(" | ");

  let markdownContent = `| ${headerRow} |\n`;
  markdownContent += `| ${separatorRow} |\n`;

  // Add data rows
  sortedTests.forEach(([testName, testResults]) => {
    const row = [testName];

    allIterations.forEach((iteration) => {
      const result = testResults.find((r) => r.iteration === iteration);
      let duration = result ? Math.round(result.duration).toString() : "-";

      // Add warning emoji for values > 1000 seconds
      if (result && (result.duration > 1000 || result.duration === 0)) {
        duration += "⚠️";
      }

      row.push(duration);
    });

    markdownContent += `| ${row.join(" | ")} |\n`;
  });

  return markdownContent;
}

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
    "Operation-Members",
    ...allIterations.map((iter) => (iter === "0" ? "Base" : iter)),
  ];

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
      let duration = result ? Math.round(result.duration).toString() : "-";

      // Add warning emoji for values > 10000 seconds or 0
      if (result && (result.duration > 10000 || result.duration === 0)) {
        duration += "⚠️";
      }

      row.push(duration.padStart(colWidths[i + 1])); // Right-align numbers
    });

    console.log("│ " + row.join(" │ ") + " │");
  });
}
