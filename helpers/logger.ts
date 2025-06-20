import fs from "fs";
import path from "path";
import winston from "winston";
import "dotenv/config";

// Known test issues for tracking
export const KNOWN_ISSUES = [
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
    testName: "Agents",
    uniqueErrorLines: [
      "FAIL  suites/agents/agents.test.ts > agents > production: clankerchat.base.eth : 0x9E73e4126bb22f79f89b6281352d01dd3d203466",
    ],
  },
  {
    testName: "Functional",
    uniqueErrorLines: [
      "FAIL  suites/functional/playwright.test.ts > playwright > conversation stream for new member",
    ],
  },
  // {
  //   testName: "Performance",
  //   uniqueErrorLines: [
  //     "FAIL  suites/metrics/performance.test.ts > m_performance > receiveGroupMessage-50: should create a group and measure all streams",
  //     "FAIL  suites/metrics/performance.test.ts > m_performance > receiveGroupMessage-100: should create a group and measure all streams",
  //     "FAIL  suites/metrics/performance.test.ts > m_performance > receiveGroupMessage-150: should create a group and measure all streams",
  //     "FAIL  suites/metrics/performance.test.ts > m_performance > receiveGroupMessage-200: should create a group and measure all streams",
  //   ],
  // },
  {
    testName: "Large",
    uniqueErrorLines: [
      "FAIL  suites/Large/conversations.test.ts > m_large_conversations > should create 100-member group and verify all workers receive new conversation notifications within acceptable time",
      "FAIL  suites/Large/conversations.test.ts > m_large_conversations > should create 150-member group and verify all workers receive new conversation notifications within acceptable time",
      "FAIL  suites/Large/conversations.test.ts > m_large_conversations > should create 200-member group and verify all workers receive new conversation notifications within acceptable time",
    ],
  },
];

// Patterns configuration
export const ERROR_PATTERNS = {
  // Patterns to track for error deduplication
  TRACK: [
    "sync worker error storage error",
    "sqlcipher_mlock",
    "Collector timed out.",
    "welcome with cursor",
    "group with welcome id",
  ],

  // Lines to ignore in logs
  IGNORE: [", last_stream_id: StreamId(0) }", ", Library)"],

  // Regex patterns for filtering logs
  FILTER: [
    /ERROR MEMORY sqlcipher_mlock: mlock\(\) returned -1 errno=12/,
    /process:sync_welcomes: xmtp_mls::groups::welcome_sync: /g,
  ],

  // Patterns to match error log lines
  MATCH: [/ERROR/, /forked/, /FAIL/, /QA_ERROR/],
} as const;

// Consolidated ANSI escape code regex
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\x1b\u001b]\[[0-9;]*[a-zA-Z]/g;

/**
 * Remove ANSI escape codes and control characters from text
 */
export function stripAnsi(text: string): string {
  return (
    text
      .replace(ANSI_REGEX, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => {
        // Keep newlines, tabs, and carriage returns
        return ["\n", "\t", "\r"].includes(char) ? char : "";
      })
  );
}

/**
 * Filter log output based on configured patterns
 */
export function filterLogOutput(data: string): string {
  let filtered = data;

  // Apply regex pattern filtering
  for (const pattern of ERROR_PATTERNS.FILTER) {
    filtered = filtered.replace(new RegExp(pattern.source, "g"), "");
  }

  // Filter out lines containing ignore patterns
  const lines = filtered.split("\n");
  const filteredLines = lines.filter((line) => {
    return !ERROR_PATTERNS.IGNORE.some((pattern) => line.includes(pattern));
  });

  return filteredLines.join("\n");
}

/**
 * Process a single log file to remove ANSI codes
 */
export async function processLogFile(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const content = await fs.promises.readFile(inputPath, "utf-8");
  const cleanedContent = stripAnsi(content);
  await fs.promises.writeFile(outputPath, cleanedContent, "utf-8");
}

/**
 * Clean all raw-*.log files by removing ANSI codes
 */
export async function cleanAllRawLogs(
  deleteOriginals: boolean = false,
): Promise<void> {
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
  const rawLogFiles = files.filter(
    (file) => file.startsWith("raw-") && file.endsWith(".log"),
  );

  if (rawLogFiles.length === 0) {
    console.log("No raw-*.log files found to clean");
    return;
  }

  console.log(`Found ${rawLogFiles.length} raw log files to clean`);

  for (const file of rawLogFiles) {
    const inputPath = path.join(logsDir, file);
    const outputFileName = file.replace("raw-", "cleaned-");
    const outputPath = path.join(outputDir, outputFileName);

    try {
      await processLogFile(inputPath, outputPath);
      console.log(`Cleaned: ${file} -> ${outputFileName}`);

      if (deleteOriginals) {
        await fs.promises.unlink(inputPath);
        console.log(`Deleted original: ${file}`);
      }
    } catch (error) {
      console.error(`Failed to clean ${file}:`, error);
    }
  }
}

// Extend winston Logger interface for custom methods
declare module "winston" {
  interface Logger {
    time(label: string): void;
    timeEnd(label: string): void;
  }
}

/**
 * Create a winston logger with custom formatting and timer methods
 */
export const createLogger = () => {
  const prettyFormat = winston.format.printf((info) => {
    return `[${info.timestamp as string}] [${info.level}] ${info.message as string}`;
  });

  const combinedFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    prettyFormat,
  );

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "silly",
    format: combinedFormat,
    transports: [new winston.transports.Console()],
  });

  // Add timer functionality
  const timers = new Map<string, number>();

  logger.time = (label: string) => {
    timers.set(label, performance.now());
  };

  logger.timeEnd = (label: string) => {
    const startTime = timers.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      timers.delete(label);
      logger.info(`${label}: ${duration.toFixed(3)}ms`);
    }
  };

  return logger;
};

/**
 * Log error with consistent formatting
 */
export const logError = (e: unknown, testName: string | undefined): boolean => {
  if (e instanceof Error) {
    console.warn(`${testName}`, e.message);
  } else {
    console.warn(`Unknown error type:`, typeof e);
  }
  return true;
};

// Global logger instance
const logger = createLogger();

/**
 * Override console methods with pretty logging
 */
export const setupPrettyLogs = (testName: string) => {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    time: console.time,
    timeEnd: console.timeEnd,
  };

  const createLogMethod = (level: keyof typeof logger, prefix = "") => {
    return (...args: unknown[]) => {
      const message = args.join(" ");
      (logger[level] as (msg: string) => void)(prefix + message);
    };
  };

  // Override console methods
  console.log = createLogMethod("info");
  console.info = createLogMethod("info");
  console.warn = createLogMethod("warn");
  console.error = createLogMethod("error", `QA_ERROR ${testName} > `);
  console.debug = createLogMethod("debug");
  console.time = (label: string) => {
    logger.time(label);
  };
  console.timeEnd = (label: string) => {
    logger.timeEnd(label);
  };

  // Return restore function
  return () => {
    Object.assign(console, originalConsole);
  };
};

/**
 * Get formatted timestamp for file naming
 */
export const getTime = (): string => {
  return new Date()
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/Buenos_Aires",
    })
    .replace(/:/g, "-");
};

/**
 * Process error line for deduplication and cleaning
 */
function processErrorLine(line: string): {
  cleanLine: string;
  shouldSkip: boolean;
} {
  let cleanLine = stripAnsi(line);

  // Skip lines with ignore patterns
  if (ERROR_PATTERNS.IGNORE.some((pattern) => cleanLine.includes(pattern))) {
    return { cleanLine, shouldSkip: true };
  }

  // Don't split lines containing test file paths
  if (cleanLine.includes("test.ts")) {
    return { cleanLine: cleanLine.trim(), shouldSkip: false };
  }

  // Extract error content after pattern markers
  for (const pattern of ERROR_PATTERNS.MATCH) {
    if (cleanLine.includes(pattern.source)) {
      cleanLine = cleanLine.split(pattern.source)[1]?.trim() || cleanLine;
      break;
    }
  }

  cleanLine = cleanLine.replace("expected false to be true", "failed").trim();

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
        if (!ERROR_PATTERNS.MATCH.some((pattern) => pattern.test(line))) {
          continue;
        }

        const { cleanLine, shouldSkip } = processErrorLine(line);
        if (shouldSkip) continue;

        // Check for pattern deduplication
        const isDuplicate = ERROR_PATTERNS.TRACK.some((pattern) => {
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
      const hasKnownPattern = ERROR_PATTERNS.TRACK.some((pattern) =>
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

export interface TestLogOptions {
  enableLogging: boolean;
  customLogFile?: string;
  testName: string;
  logFileName?: string;
  verboseLogging?: boolean;
}

/**
 * Create a test logger with file output and filtering
 */
export const createTestLogger = (options: TestLogOptions) => {
  let logStream: fs.WriteStream | undefined;
  let logFileName = "";

  if (options.enableLogging) {
    const logsDir = "logs";
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    if (options.customLogFile) {
      logFileName = options.customLogFile;
    } else {
      const cleanTestName = path
        .basename(options.testName)
        .replace(/\.test\.ts$/, "");
      logFileName = `raw-${process.env.XMTP_ENV}-${cleanTestName}-${getTime()}.log`;
    }

    const logPath = path.join(logsDir, logFileName);
    logStream = fs.createWriteStream(logPath, { flags: "w" });

    console.log(`Logging to: ${logPath}`);
    console.log(
      options.verboseLogging
        ? "Verbose logging enabled: output will be shown in terminal AND logged to file."
        : "Test output will be hidden from terminal and logged to file only.",
    );
  } else {
    console.log(
      "Warning: Logging is disabled. Test output will not be visible anywhere.",
    );
    console.log("Consider using --debug to enable file logging.");
  }

  const processOutput = (data: Buffer) => {
    const text = data.toString();
    const filtered = filterLogOutput(text);

    if (filtered.trim()) {
      logStream?.write(filtered);
      if (options.verboseLogging) {
        process.stdout.write(filtered);
      }
    }
  };

  const close = () => {
    logStream?.end();
  };

  return {
    processOutput,
    close,
    logFileName,
  };
};

/**
 * Add file logging capability to the global logger
 */
export const addFileLogging = (filename: string) => {
  const logPath = path.join(
    process.cwd(),
    "logs",
    `${filename}-${process.env.XMTP_ENV}-${getTime()}.log`,
  );

  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  logger.add(
    new winston.transports.File({
      filename: logPath,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          return `[${info.timestamp as string}] [${info.level}] ${info.message as string}`;
        }),
      ),
    }),
  );
};
