import fs from "fs";
import path from "path";
import winston from "winston";
import "dotenv/config";

// Unified configuration object
export const CONFIG = {
  // Error processing thresholds
  errorLineMinLength: 40,
  errorLineMaxLength: 150,
  errorLineTruncateLength: 147,

  // Text replacements
  errorReplacement: {
    from: "expected false to be true",
    to: "failed",
  },

  // File processing strings
  forkSearchStrings: {
    short: "may be fork",
    full: "your group may be forked",
  },

  // File patterns and extensions
  filePatterns: {
    rawPrefix: "raw-",
    cleanedPrefix: "cleaned-",
    logExtension: ".log",
    testExtension: ".test.ts",
  },

  // Default values
  defaultLogLevel: "info",
  timeZone: "America/Buenos_Aires",

  // Directory names
  directories: {
    logs: "logs",
    cleaned: "cleaned",
  },

  // Error patterns for filtering and deduplication
  errorPatterns: {
    dedupe: [
      "sync worker error storage error",
      "sqlcipher_mlock",
      "Collector timed out.",
      "welcome with cursor",
      "group with welcome id",
      "receiveGroupMessage",
      "xmtp_mls::groups::mls_sync",
    ],
    match: [/ERROR/, /forked/, /FAIL/, /QA_ERROR/],
  },

  // Known test issues
  knownIssues: [
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
} as const;

// Legacy exports for backward compatibility
export const KNOWN_ISSUES = CONFIG.knownIssues;

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\x1b\u001b]\[[0-9;]*[a-zA-Z]/g;

/**
 * Remove ANSI escape codes from text
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

/**
 * Clean and process log files by removing ANSI codes and stopping at fork lines
 */
export function processLogFile(inputPath: string, outputPath: string): void {
  const content = fs.readFileSync(inputPath, "utf8");
  const lines = content.split("\n");
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const cleanLine = stripAnsi(line);
    cleanedLines.push(cleanLine);

    if (cleanLine.toLowerCase().includes(CONFIG.forkSearchStrings.short)) {
      break;
    }
  }

  fs.writeFileSync(outputPath, cleanedLines.join("\n"));
}

/**
 * Clean all raw-*.log files that contain fork messages
 */
export function cleanAllRawLogs(): void {
  const logsDir = path.join(process.cwd(), CONFIG.directories.logs);
  const outputDir = path.join(logsDir, CONFIG.directories.cleaned);

  if (!fs.existsSync(logsDir)) return;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(logsDir);
  const rawLogFiles = files.filter(
    (file) =>
      file.startsWith(CONFIG.filePatterns.rawPrefix) &&
      file.endsWith(CONFIG.filePatterns.logExtension),
  );

  let processedCount = 0;
  for (const file of rawLogFiles) {
    const inputPath = path.join(logsDir, file);
    const content = fs.readFileSync(inputPath, "utf8");

    if (!content.includes(CONFIG.forkSearchStrings.full)) continue;

    const outputFileName = file.replace(
      CONFIG.filePatterns.rawPrefix,
      CONFIG.filePatterns.cleanedPrefix,
    );
    const outputPath = path.join(outputDir, outputFileName);

    processLogFile(inputPath, outputPath);
    processedCount++;
  }

  console.log(`Processed ${processedCount} files containing fork messages`);
}

// Extend winston Logger interface
declare module "winston" {
  interface Logger {
    time(label: string): void;
    timeEnd(label: string): void;
  }
}

/**
 * Create winston logger with timer methods
 */
export const createLogger = () => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || CONFIG.defaultLogLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf(
        (info) =>
          `[${String(info.timestamp)}] [${String(info.level)}] ${String(info.message)}`,
      ),
    ),
    transports: [new winston.transports.Console()],
  });

  const timers = new Map<string, number>();

  logger.time = (label: string) => timers.set(label, performance.now());
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
    console.warn(testName || "unknown", e.message);
  } else {
    console.warn(`Unknown error type:`, typeof e);
  }
  return true;
};

const logger = createLogger();

/**
 * Override console methods with winston logging
 */
export const setupPrettyLogs = (testName: string) => {
  const originalConsole = { ...console };

  console.log = (...args: unknown[]) => logger.info(args.join(" "));
  console.info = (...args: unknown[]) => logger.info(args.join(" "));
  console.warn = (...args: unknown[]) => logger.warn(args.join(" "));
  console.error = (...args: unknown[]) =>
    logger.error(`QA_ERROR ${String(testName)} > ${String(args.join(" "))}`);
  console.debug = (...args: unknown[]) => logger.debug(args.join(" "));
  console.time = (label: string) => {
    logger.time(label);
  };
  console.timeEnd = (label: string) => {
    logger.timeEnd(label);
  };

  return () => Object.assign(console, originalConsole);
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
      timeZone: CONFIG.timeZone,
    })
    .replace(/:/g, "-");
};

/**
 * Process and clean error line
 */
function cleanErrorLine(line: string): string | null {
  let cleanLine = stripAnsi(line);

  // Keep test file paths intact
  if (cleanLine.includes(CONFIG.filePatterns.testExtension)) {
    return cleanLine.trim();
  }

  // Extract content after error markers
  for (const pattern of CONFIG.errorPatterns.match) {
    const parts = cleanLine.split(pattern.source);
    if (parts.length > 1) {
      cleanLine = parts[1]?.trim() || cleanLine;
      break;
    }
  }

  cleanLine = cleanLine
    .replace(CONFIG.errorReplacement.from, CONFIG.errorReplacement.to)
    .trim();

  // Skip short or empty lines
  if (cleanLine.length < CONFIG.errorLineMinLength) return null;

  // Truncate long lines
  if (cleanLine.length > CONFIG.errorLineMaxLength) {
    cleanLine = cleanLine.substring(0, CONFIG.errorLineTruncateLength) + "...";
  }

  return cleanLine;
}

/**
 * Extract unique error logs from files with deduplication
 */
export function extractErrorLogs(
  testName: string,
  limit?: number,
): Set<string> {
  if (!fs.existsSync(CONFIG.directories.logs)) return new Set();

  try {
    const logFiles = fs
      .readdirSync(CONFIG.directories.logs)
      .filter(
        (file) =>
          file.endsWith(CONFIG.filePatterns.logExtension) &&
          file.includes(testName),
      );

    const errorLines: string[] = [];
    const seenPatterns = new Set<string>();

    for (const logFile of logFiles) {
      const logPath = path.join(CONFIG.directories.logs, logFile);
      const content = fs.readFileSync(logPath, "utf-8");

      for (const line of content.split("\n")) {
        // Check if line matches error patterns
        if (!CONFIG.errorPatterns.match.some((pattern) => pattern.test(line)))
          continue;

        const cleanLine = cleanErrorLine(line);
        if (!cleanLine) continue;

        // Check for known patterns to dedupe
        let isDuplicate = false;
        for (const pattern of CONFIG.errorPatterns.dedupe) {
          if (cleanLine.includes(pattern)) {
            if (seenPatterns.has(pattern)) {
              isDuplicate = true;
              break;
            }
            seenPatterns.add(pattern);
          }
        }

        if (!isDuplicate) {
          errorLines.push(cleanLine);
        }
      }
    }

    // Return limited results
    const result = limit ? errorLines.slice(-limit) : errorLines;
    return new Set(result);
  } catch (error) {
    console.error("Error reading log files:", error);
    return new Set();
  }
}

export interface TestLogOptions {
  enableLogging: boolean;
  customLogFile?: string;
  testName: string;
  logFileName?: string;
  verboseLogging?: boolean;
}

/**
 * Create test logger with file output
 */
export const createTestLogger = (options: TestLogOptions) => {
  let logStream: fs.WriteStream | undefined;
  let logFileName = "";

  if (options.enableLogging) {
    const logsDir = CONFIG.directories.logs;
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    logFileName =
      options.customLogFile ||
      `${CONFIG.filePatterns.rawPrefix}${process.env.XMTP_ENV}-${path
        .basename(options.testName)
        .replace(
          CONFIG.filePatterns.testExtension,
          "",
        )}-${getTime()}${CONFIG.filePatterns.logExtension}`;

    const logPath = path.join(logsDir, logFileName);
    logStream = fs.createWriteStream(logPath, { flags: "w" });
  }

  const processOutput = (data: Buffer) => {
    const text = data.toString();
    if (text.trim()) {
      logStream?.write(text);
      if (options.verboseLogging) {
        process.stdout.write(text);
      }
    }
  };

  const close = () => logStream?.end();

  return { processOutput, close, logFileName };
};

/**
 * Add file logging to global logger
 */
export const addFileLogging = (filename: string) => {
  const logPath = path.join(
    process.cwd(),
    CONFIG.directories.logs,
    `${filename}-${process.env.XMTP_ENV}-${getTime()}${CONFIG.filePatterns.logExtension}`,
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
        winston.format.printf(
          (info) =>
            `[${String(info.timestamp)}] [${String(info.level)}] ${String(info.message)}`,
        ),
      ),
    }),
  );
};
