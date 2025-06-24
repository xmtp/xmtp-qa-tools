import fs from "fs";
import path from "path";
import { stripAnsi } from "./logger";

// Known test issues for tracking
export const PATTERNS = {
  KNOWN_ISSUES: [
    {
      testName: "Browser",
      uniqueErrorLines: [
        "FAIL  suites/browser/browser.test.ts > browser > conversation stream for new member",
      ],
    },
    {
      testName: "Dms",
      uniqueErrorLines: [
        "FAIL  suites/functional/dms.test.ts > dms > fail on purpose",
      ],
    },
    {
      testName: "Functional",
      uniqueErrorLines: [
        "FAIL  suites/functional/playwright.test.ts > playwright > conversation stream for new member",
      ],
    },
  ],
  minumumLineLength: 40,
  maxLineLength: 150,

  DEDUPE: [
    "sync worker error storage error",
    "sqlcipher_mlock",
    "Collector timed out.",
    "welcome with cursor",
    "group with welcome id",
    "receiveGroupMessage",
    "xmtp_mls::groups::mls_sync",
    "xmtp_mls::groups::welcome_sync",
  ],

  // Patterns to match error log lines
  MATCH: [/ERROR/, /forked/, /FAIL/, /QA_ERROR/],
} as const;

/**
 * Process error line for deduplication and cleaning
 */
export function processErrorLine(line: string): {
  cleanLine: string;
  shouldSkip: boolean;
} {
  let cleanLine = stripAnsi(line);

  // Don't split lines containing test file paths
  if (cleanLine.includes("test.ts")) {
    return { cleanLine: cleanLine.trim(), shouldSkip: false };
  }

  // Extract error content after pattern markers
  for (const pattern of PATTERNS.MATCH) {
    if (cleanLine.includes(pattern.source)) {
      cleanLine = cleanLine.split(pattern.source)[1]?.trim() || cleanLine;
      break;
    }
  }

  cleanLine = cleanLine.replace("expected false to be true", "failed").trim();

  if (cleanLine.length < PATTERNS.minumumLineLength) {
    return { cleanLine, shouldSkip: true };
  }
  // Trim long lines to 200 characters max
  if (cleanLine.length > PATTERNS.maxLineLength) {
    cleanLine = cleanLine.substring(0, PATTERNS.maxLineLength - 3) + "...";
  }

  return { cleanLine, shouldSkip: false };
}

/**
 * Extract error logs from log files with deduplication
 */
export function extractErrorLogs(
  testName: string,
  limit?: number,
): Set<string> {
  if (!fs.existsSync("logs")) {
    return new Set();
  }

  try {
    const logFiles = fs
      .readdirSync("logs")
      .filter((file) => file.endsWith(".log") && file.includes(testName));

    const errorLines: string[] = [];
    const seenPatterns = new Set<string>();

    for (const logFile of logFiles) {
      const logPath = path.join("logs", logFile);
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        if (!PATTERNS.MATCH.some((pattern) => pattern.test(line))) {
          continue;
        }

        const { cleanLine, shouldSkip } = processErrorLine(line);
        if (shouldSkip) continue;

        // Check for pattern deduplication
        const isDuplicate = PATTERNS.DEDUPE.some((pattern) => {
          if (cleanLine.includes(pattern)) {
            if (seenPatterns.has(pattern)) {
              return true;
            }
            seenPatterns.add(pattern);
          }
          return false;
        });

        if (!isDuplicate) {
          errorLines.push(cleanLine);
        }
      }
    }

    console.log(
      `Found ${errorLines.length} error lines${limit ? `, limiting to ${limit}` : ""}`,
    );

    // Return empty set if only one error and it's a known pattern
    if (errorLines.length === 1) {
      const hasKnownPattern = PATTERNS.DEDUPE.some((pattern) =>
        errorLines[0]?.includes(pattern),
      );
      if (hasKnownPattern) {
        console.log("returning empty string");
        return new Set();
      }
    }

    if (errorLines.length > 0) {
      const limitedErrors = limit ? errorLines.slice(-limit) : errorLines;
      const resultSet = new Set(limitedErrors);
      console.log(resultSet);
      return resultSet;
    }
  } catch (error) {
    console.error("Error reading log files:", error);
  }

  return new Set();
}

/**
 * Extract lines that contain test failures
 */
export function extractFailLines(errorLogs: Set<string>): string[] {
  return Array.from(errorLogs).filter((log) => log.includes("FAIL  suites/"));
}

/**
 * Sanitize logs for safe display in messaging platforms
 */
export function sanitizeLogs(logs: string): string {
  return logs.replaceAll(/```/g, "'''");
}

/**
 * Check if test should be filtered out based on known issues
 */
export function shouldFilterOutTest(errorLogs: Set<string>): boolean {
  if (!errorLogs || errorLogs.size === 0) {
    return false;
  }

  const failLines = extractFailLines(errorLogs);

  if (failLines.length === 0) {
    return true; // Don't show if tests don't fail
  }

  // Check each configured filter
  for (const filter of PATTERNS.KNOWN_ISSUES) {
    const matchingLines = failLines.filter((line) =>
      filter.uniqueErrorLines.some((errorLine) => line.includes(errorLine)),
    );

    // If all fail lines match this filter's unique error lines, filter it out
    if (matchingLines.length > 0 && matchingLines.length === failLines.length) {
      console.log(`Test filtered out (${filter.testName} test failure)`);
      return true;
    }
  }

  return false;
}
