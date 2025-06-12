import fs from "fs";
import path from "path";
import winston from "winston";

// Patterns to track for error deduplication and log filtering
export const PATTERNS_TO_TRACK = [
  "sync worker error storage error",
  "sqlcipher_mlock",
  // Add more patterns here as needed
];

export const LOG_FILTER_PATTERNS = [
  /ERROR MEMORY sqlcipher_mlock: mlock\(\) returned -1 errno=12/,
  // Add more patterns here as needed
];

// Patterns to match log lines for error extraction
export const LOG_LINE_MATCH_PATTERNS = [/ERROR/, /forked/, /FAIL/];

/**
 * Remove ANSI escape codes from text
 * This regex matches all ANSI escape sequences including:
 * - Color codes (\x1b[31m, \x1b[0m, etc.)
 * - Cursor movement codes
 * - Other terminal control sequences
 */
export function stripAnsi(text: string): string {
  // ANSI escape code regex pattern
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;

  // Also handle some common ANSI sequences that might be encoded differently
  // eslint-disable-next-line no-control-regex
  const ansiRegex2 = /\u001b\[[0-9;]*[a-zA-Z]/g;

  return (
    text
      .replace(ansiRegex, "")
      .replace(ansiRegex2, "")
      // Remove any remaining control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => {
        // Keep newlines, tabs, and carriage returns
        if (char === "\n" || char === "\t" || char === "\r") {
          return char;
        }
        return "";
      })
  );
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
    } catch (error) {
      console.error(`Failed to clean ${file}:`, error);
    }
  }
}

// Create a simple logger that formats logs in a pretty way
export const createLogger = () => {
  // Format timestamp to match [YYYY-MM-DDThh:mm:ss.sssZ]
  const prettyFormat = winston.format.printf((info) => {
    return `[${info.timestamp as string}] [${info.level}] ${info.message as string}`;
  });

  // Combine formats
  const combinedFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    prettyFormat,
  );

  // Create the logger with console transport
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "silly",
    format: combinedFormat,
    transports: [new winston.transports.Console()],
  });

  // Add time and timeEnd methods to the logger
  const timers = new Map<string, number>();

  // Add custom time method
  logger.time = (label: string) => {
    timers.set(label, performance.now());
    //  logger.info(${label});
  };

  // Add custom timeEnd method
  logger.timeEnd = (label: string) => {
    const startTime = timers.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      timers.delete(label);
      logger.info(`${label}: ${duration.toFixed(3)}ms`);
    } else {
      // logger.warn(`Timer "${label}" does not exist`);
    }
  };

  return logger;
};

export const logError = (e: unknown, testName: string | undefined): boolean => {
  if (e instanceof Error) {
    console.error(`Test failed in ${testName}`, e.message);
  } else {
    console.error(`Unknown error type:`, typeof e);
  }
  return true;
};

// Extend the winston Logger type to include our custom methods
declare module "winston" {
  interface Logger {
    time(label: string): void;
    timeEnd(label: string): void;
  }
}

// Create a global logger instance
const logger = createLogger();

// Override console methods to use the pretty logger
export const setupPrettyLogs = () => {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    time: console.time,
    timeEnd: console.timeEnd,
  };

  // Override console.log
  console.log = (...args) => {
    const message = args.join(" ");
    logger.info(message);
  };

  // Override console.info
  console.info = (...args) => {
    const message = args.join(" ");
    logger.info(message);
  };

  // Override console.warn
  console.warn = (...args) => {
    const message = args.join(" ");
    logger.warn(message);
  };

  // Override console.error
  console.error = (...args) => {
    const message = args.join(" ");
    logger.error(message);
  };

  // Override console.debug
  console.debug = (...args) => {
    const message = args.join(" ");
    logger.debug(message);
  };

  // Override console.time
  console.time = (...args) => {
    const message = args.join(" ");
    logger.time(message);
  };

  // Override console.timeEnd
  console.timeEnd = (...args) => {
    const message = args.join(" ");
    logger.timeEnd(message);
  };

  // Return function to restore original console if needed
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.time = originalConsole.time;
    console.timeEnd = originalConsole.timeEnd;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  };
};

export const getTime = () => {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Buenos_Aires",
  });
  return time.replace(/:/g, "-");
};

export const filterLogOutput = (data: string): string => {
  let filtered = data;
  for (const pattern of LOG_FILTER_PATTERNS) {
    filtered = filtered.replace(new RegExp(pattern.source, "g"), "");
  }
  return filtered;
};

export interface TestLogOptions {
  enableLogging: boolean;
  customLogFile?: string;
  testName: string;
  logFileName?: string;
  verboseLogging?: boolean;
}

// Extract error logs from log files
export function extractErrorLogs(testName: string): Set<string> {
  if (!fs.existsSync("logs")) {
    return new Set();
  }
  console.log("testName", testName);

  try {
    const logFiles = fs
      .readdirSync("logs")
      .filter((file) => file.endsWith(".log") && file.includes(testName));
    const errorLines: Set<string> = new Set();

    // Track specific error patterns we want to deduplicate
    const seenPatterns = new Set<string>();

    for (const logFile of logFiles) {
      const logPath = path.join("logs", logFile);
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        if (LOG_LINE_MATCH_PATTERNS.some((pattern) => pattern.test(line))) {
          // Use the comprehensive stripAnsi function instead of simple regex
          let cleanLine = stripAnsi(line);

          if (cleanLine.includes("ERROR")) {
            cleanLine = cleanLine.split("ERROR")[1].trim();
          }
          if (cleanLine.includes("FAIL")) {
            cleanLine = cleanLine.split("FAIL")[1].trim();
          }
          if (cleanLine.includes("forked")) {
            cleanLine = cleanLine.split("forked")[1].trim();
          }
          if (cleanLine.includes("//")) {
            cleanLine = cleanLine.split("//")[0]?.trim();
          }
          cleanLine = cleanLine?.replace("expected false to be true", "failed");
          cleanLine = cleanLine?.trim();
          // Check if this line contains any patterns we want to deduplicate
          let shouldSkip = false;
          for (const pattern of PATTERNS_TO_TRACK) {
            if (cleanLine.includes(pattern)) {
              if (seenPatterns.has(pattern)) {
                shouldSkip = true;
                break;
              } else {
                seenPatterns.add(pattern);
              }
            }
          }

          if (!shouldSkip) {
            errorLines.add(cleanLine);
          }
        }
      }
    }

    console.debug(errorLines);
    if (errorLines.size === 1) {
      for (const pattern of PATTERNS_TO_TRACK) {
        if (errorLines.values().next().value?.includes(pattern)) {
          console.log("returning empty string");
          return new Set();
        }
      }
    } else if (errorLines.size > 0) {
      return errorLines;
    }
  } catch (error) {
    console.error("Error reading log files:", error);
  }

  return new Set();
}

export const createTestLogger = (options: TestLogOptions) => {
  let logStream: fs.WriteStream | undefined;
  // Extract clean test name for log file (remove path and extension)
  let logFileName: string = "";

  if (options.enableLogging) {
    // Ensure logs directory exists
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

    if (options.verboseLogging) {
      console.log(
        "Verbose logging enabled: output will be shown in terminal AND logged to file.",
      );
    } else {
      console.log(
        "Test output will be hidden from terminal and logged to file only.",
      );
    }
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
      // Write to file if logging is enabled
      if (logStream) {
        logStream.write(filtered);
      }

      // Also write to terminal if verbose logging is enabled
      if (options.verboseLogging) {
        process.stdout.write(filtered);
      }
    }
  };

  const close = () => {
    if (logStream) {
      logStream.end();
    }
  };

  return {
    processOutput,
    close,
    logFileName,
  };
};

// Optional: Add file logging capability
export const addFileLogging = (filename: string) => {
  const logPath = path.join(
    process.cwd(),
    "logs",
    filename + "-" + String(process.env.XMTP_ENV) + "-" + getTime() + ".log",
  );
  const dir = path.dirname(logPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Add file transport to the logger
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
