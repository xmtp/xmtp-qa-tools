import fs from "fs";
import path from "path";
import { processLogFile, stripAnsi } from "./logger";

// Known test issues for tracking
export const PATTERNS = {
  KNOWN_ISSUES: [
    {
      testName: "Dms",
      uniqueErrorLines: [
        "FAIL  suites/functional/dms.test.ts > dms > should fail on purpose",
      ],
    },
  ],
  min_fail_lines: 3,
  min_line_length: 40,
  max_line_length: 150,
  max_error_logs: 20,

  DEDUPE: [
    "sqlcipher_mlock",
    "Collector timed out.",
    "KeyPackageCleaner worker error:",
    "DeviceSync worker error:",
    "welcome with cursor",
    "group with welcome id",
    "receiveGroupMessage",
    "receiveNewConversation",
    "Skipping welcome",
    "Skipping already processed",
    "xmtp_mls::groups::key_package_cleaner_worker",
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

  if (cleanLine.length < PATTERNS.min_line_length) {
    return { cleanLine, shouldSkip: true };
  }
  // Trim long lines to 200 characters max
  if (cleanLine.length > PATTERNS.max_line_length) {
    cleanLine = cleanLine.substring(0, PATTERNS.max_line_length - 3) + "...";
  }

  return { cleanLine, shouldSkip: false };
}

/**
 * Check if a large file contains a target string using streaming
 */
async function fileContainsString(
  filePath: string,
  targetString: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, {
      encoding: "utf8",
      highWaterMark: 64 * 1024,
    }); // 64KB chunks
    let buffer = "";
    let found = false;

    stream.on("data", (chunk: string | Buffer) => {
      const chunkStr =
        typeof chunk === "string" ? chunk : chunk.toString("utf8");
      buffer += chunkStr;

      // Check if we found the target string
      if (buffer.includes(targetString)) {
        found = true;
        stream.destroy(); // Stop reading
        return;
      }

      // Keep only the last part of buffer to handle strings that span chunks
      // Keep twice the target string length to be safe
      const keepLength = targetString.length * 2;
      if (buffer.length > keepLength) {
        buffer = buffer.slice(-keepLength);
      }
    });

    stream.on("end", () => {
      resolve(found);
    });

    stream.on("error", (error) => {
      reject(error);
    });

    stream.on("close", () => {
      resolve(found);
    });
  });
}

export async function cleanAllRawLogs(pattern: string = ""): Promise<void> {
  const logsDir = path.join(process.cwd(), "logs");
  const outputDir = path.join(logsDir, "cleaned");

  if (!fs.existsSync(logsDir)) {
    console.debug("No logs directory found");
    return;
  }

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  const files = await fs.promises.readdir(logsDir);
  // Look for raw log files
  const rawLogFiles = files.filter(
    (file) => file.startsWith("raw-") && file.endsWith(".log"),
  );

  if (rawLogFiles.length === 0) {
    console.debug("No raw *.log files found to check");
    return;
  }

  console.debug(`Found ${rawLogFiles.length} raw log files to check`);

  let processedCount = 0;
  for (const file of rawLogFiles) {
    const rawFilePath = path.join(logsDir, file);

    try {
      const outputFileName = file.replace("raw-", "cleaned-");
      const outputPath = path.join(outputDir, outputFileName);

      await processLogFile(rawFilePath, outputPath);
      console.debug(`Cleaned: ${file} -> ${outputFileName}`);
      processedCount++;
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }

  console.debug(
    `Processed ${processedCount} raw files containing "${pattern}"`,
  );
}

/**
 * Clean forks logs and remove non-forks logs
 */
export async function cleanForksLogs(
  removeNonMatching: boolean = true,
): Promise<void> {
  const logsDir = path.join(process.cwd(), "logs");
  const outputDir = path.join(logsDir, "cleaned");

  if (!fs.existsSync(logsDir)) {
    console.debug("No logs directory found");
    return;
  }

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  const files = await fs.promises.readdir(logsDir);
  // Look for raw log files that contain "forks" in the name
  const forksLogFiles = files.filter(
    (file) =>
      file.startsWith("raw-") &&
      file.includes("forks") &&
      file.endsWith(".log"),
  );

  if (forksLogFiles.length === 0) {
    console.debug("No forks log files found to check");
    return;
  }

  console.debug(`Found ${forksLogFiles.length} forks log files to check`);

  let processedCount = 0;
  let removedCount = 0;
  for (const file of forksLogFiles) {
    const rawFilePath = path.join(logsDir, file);

    try {
      // Check if the file contains fork-related content
      const containsForkContent = await fileContainsString(
        rawFilePath,
        "may be fork",
      );

      if (!containsForkContent) {
        if (removeNonMatching) {
          await fs.promises.unlink(rawFilePath);
          console.debug(`Removed ${file} - does not contain fork content`);
          removedCount++;
        } else {
          console.debug(`Skipping ${file} - does not contain fork content`);
        }
        continue;
      }

      const outputFileName = file.replace("raw-", "cleaned-");
      const outputPath = path.join(outputDir, outputFileName);

      await processLogFile(rawFilePath, outputPath);
      console.debug(`Cleaned forks log: ${file} -> ${outputFileName}`);
      processedCount++;
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }

  if (removeNonMatching && removedCount > 0) {
    console.debug(
      `Removed ${removedCount} files that did not contain fork content`,
    );
  }
  console.debug(`Processed ${processedCount} forks log files`);
}

/**
 * Check for critical transport/infrastructure errors that should cause immediate process exit
 */
export function checkForCriticalErrors(
  testName: string,
  failLines: string[],
): void {
  if (failLines.length === 1) {
    const failLine = failLines[0];

    const match = failLine.match(
      /FAIL\s+(suites\/[^[]+)\s+\[\s+(suites\/[^\]]+)\s+\]/,
    );

    if (match) {
      const outsidePath = match[1]?.trim();
      const insidePath = match[2]?.trim();

      console.debug(`DEBUG: outsidePath: "${outsidePath}"`);
      console.debug(`DEBUG: insidePath: "${insidePath}"`);
      console.debug(`DEBUG: Are paths equal? ${outsidePath === insidePath}`);

      if (outsidePath === insidePath) {
        console.error(
          `❌ CRITICAL TEST SUITE FAILURE DETECTED: ${outsidePath}`,
        );
        process.exit(2);
      }
    }
  }
}

/**
 * Extract error logs from log files with deduplication
 */
export function extractErrorLogs(testName: string): Set<string> {
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

    // Return empty set if only one error and it's a known pattern
    if (errorLines.length === 1) {
      const hasKnownPattern = PATTERNS.DEDUPE.some((pattern) =>
        errorLines[0]?.includes(pattern),
      );
      if (hasKnownPattern) {
        return new Set();
      }
    }
    const limit = PATTERNS.max_error_logs;
    if (errorLines.length > 0) {
      const limitedErrors = errorLines.slice(-limit);
      const resultSet = new Set(limitedErrors);
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
export function extractfail_lines(errorLogs: Set<string>): string[] {
  return Array.from(errorLogs).filter((log) => log.includes("FAIL  suites/"));
}

/**
 * Sanitize logs for safe display in messaging platforms
 */
export function sanitizeLogs(logs: string): string {
  return logs.replaceAll(/```/g, "'''");
}
