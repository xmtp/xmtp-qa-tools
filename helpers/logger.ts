import fs from "fs";
import path from "path";
import winston from "winston";

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
    logger.error("ERROR " + message);
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

// Log filtering utilities
const LOG_FILTER_PATTERNS = [
  /ERROR MEMORY sqlcipher_mlock: mlock\(\) returned -1 errno=12/,
  // Add more patterns here as needed
];

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
}

// Extract error logs from log files
export function extractErrorLogs(testName: string): string {
  if (!fs.existsSync("logs")) {
    return "";
  }
  console.log("testName", testName);

  try {
    const logFiles = fs
      .readdirSync("logs")
      .filter((file) => file.endsWith(".log") && file.includes(testName));
    const errorLines: Set<string> = new Set();

    for (const logFile of logFiles) {
      const logPath = path.join("logs", logFile);
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        if (/ERROR/.test(line)) {
          //remove ansi codes
          const ansiRegex = new RegExp(
            `[${String.fromCharCode(27)}${String.fromCharCode(155)}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
            "g",
          );
          let cleanLine = line.replace(ansiRegex, "");
          if (cleanLine.includes("ERROR")) {
            cleanLine = cleanLine.split("ERROR")[1].trim();
          }

          if (cleanLine.includes("//")) {
            cleanLine = cleanLine.split("//")[0]?.trim();
          }
          cleanLine = cleanLine?.replace("expected false to be true", "failed");
          errorLines.add(cleanLine);
        }
      }
    }

    console.log(errorLines);
    if (errorLines.size > 0) {
      return `\n\n*Error Logs:*\n\`\`\`\n${Array.from(errorLines)
        .slice(0, 10)
        .join("\n")}\n\`\`\``;
    }
  } catch (error) {
    console.error("Error reading log files:", error);
  }

  return "";
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
    console.log(
      "Test output will be hidden from terminal and logged to file only.",
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

    if (filtered.trim() && logStream) {
      logStream.write(filtered);
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
