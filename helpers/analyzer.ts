import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { processLogFile, stripAnsi } from "./logger";

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
    {
      testName: "Functional",
      uniqueErrorLines: [
        "FAIL  suites/functional/callbacks.test.ts > callbacks > should receive conversation with async",
        "FAIL  suites/functional/playwright.test.ts > playwright > newGroup and message stream",
      ],
    },
    {
      testName: "Agents-dms",
      uniqueErrorLines: [
        "FAIL  suites/agents/agents.test.ts > agents > production: tokenbot : 0x9E73e4126bb22f79f89b6281352d01dd3d203466",
      ],
    },
    {
      testName: "Functional",
      uniqueErrorLines: [
        "FAIL  suites/functional/playwright.test.ts > playwright > conversation stream for new member",
      ],
    },
    {
      testName: "Agents-tagged",
      uniqueErrorLines: [
        "FAIL  suites/agents/agents-tagged.test.ts [ suites/agents/agents-tagged.test.ts ]",
        "FAIL  suites/agents/agents-tagged.test.ts > agents-tagged",
      ],
    },
    {
      testName: "Agents-untagged",
      uniqueErrorLines: [
        "FAIL  suites/agents/agents-untagged.test.ts [ suites/agents/agents-untagged.test.ts ]",
        "FAIL  suites/agents/agents-untagged.test.ts > agents-untagged",
      ],
    },
    {
      testName: "Agents-dms",
      uniqueErrorLines: [
        "FAIL  suites/agents/agents.test.ts > agents > production: tokenbot : 0x9E73e4126bb22f79f89b6281352d01dd3d203466",
      ],
    },
  ],
  minFailLines: 3,
  minumumLineLength: 40,
  maxLineLength: 150,

  DEDUPE: [
    "sqlcipher_mlock",
    "Collector timed out.",
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
 * Clean raw-*.log files by checking corresponding non-raw log files for "fork" content
 * If a non-raw file contains "fork", clean the corresponding raw file
 */
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

export async function cleanAllRawLogs(): Promise<void> {
  const logsDir = path.join(process.cwd(), "logs");
  const outputDir = path.join(logsDir, "cleaned");

  if (!fs.existsSync(logsDir)) {
    console.log("No logs directory found");
    return;
  }

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  const files = await fs.promises.readdir(logsDir);
  // Look for non-raw log files instead
  const nonRawLogFiles = files.filter(
    (file) => file.startsWith("raw-") && file.endsWith(".log"),
  );

  if (nonRawLogFiles.length === 0) {
    console.log("No non-raw *.log files found to check");
    return;
  }

  console.log(`Found ${nonRawLogFiles.length} non-raw log files to check`);

  let processedCount = 0;
  for (const file of nonRawLogFiles) {
    const inputPath = path.join(logsDir, file);

    try {
      // Check if non-raw file contains "fork" using streaming
      const containsTargetString = await fileContainsString(
        inputPath,
        "Fork detected",
      );

      if (!containsTargetString) {
        console.log(`Skipping ${file} - does not contain "fork"`);
        continue;
      }

      // Construct the corresponding raw filename
      const rawFileName = file;
      const rawFilePath = path.join(logsDir, rawFileName);

      // Check if the raw file exists
      if (!fs.existsSync(rawFilePath)) {
        console.log(
          `Skipping ${file} - corresponding raw file ${rawFileName} not found`,
        );
        continue;
      }

      const outputFileName = rawFileName.replace("raw-", "cleaned-");
      const outputPath = path.join(outputDir, outputFileName);

      await processLogFile(rawFilePath, outputPath);
      console.log(
        `Cleaned: ${rawFileName} -> ${outputFileName} (triggered by ${file})`,
      );
      processedCount++;
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }

  console.log(
    `Processed ${processedCount} raw files based on non-raw files containing "fork"`,
  );
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
        console.log("hasKnownPattern, returning empty string");
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
  const jobStatus = process.env.GITHUB_JOB_STATUS || "failed";
  if (jobStatus === "success") {
    console.log(`Slack notification skipped (status: ${jobStatus})`);
    return true;
  }

  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.log(`Slack notification skipped (branch: ${branchName})`);
    return true;
  }

  if (!errorLogs || errorLogs.size === 0) {
    return true;
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

export async function sendSlackNotification(options: {
  testName: string;
  errorLogs: Set<string>;
  channel?: string;
}): Promise<void> {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const workflowRunUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;

  const targetChannel = options.channel || process.env.SLACK_CHANNEL;
  const testName = options.testName
    ? options.testName[0].toUpperCase() + options.testName.slice(1) + " - "
    : "";

  const shouldTagFabri = options.errorLogs.size >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const sections = [
    `*${testName}*: ⚠️ - ${tagMessage}`,
    `*Environment*: ${process.env.ENVIRONMENT || process.env.XMTP_ENV}`,
    `*Region*: ${process.env.GEOLOCATION}`,
    `*Test URL*: <${workflowRunUrl} | ${workflowRunUrl}>`,
    `Logs:\n\`\`\`${sanitizeLogs(Array.from(options.errorLogs).join("\n"))}\`\`\``,
  ];

  const message = sections.filter(Boolean).join("\n");
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: targetChannel,
      text: message,
      mrkdwn: true,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    [key: string]: unknown;
  };

  if (data && data.ok) {
    console.log(`✅ Slack notification sent successfully to ${targetChannel}!`);
  } else {
    console.error("❌ Failed to send Slack notification. Response:", data);
  }
}
