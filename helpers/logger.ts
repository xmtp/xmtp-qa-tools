import fs from "fs";
import path from "path";
import winston from "winston";
import "dotenv/config";

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
 * Process a single log file to remove ANSI codes and stop after first "may be fork..." line
 */
export async function processLogFile(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const readStream = fs.createReadStream(inputPath, {
      encoding: "utf8",
      highWaterMark: 64 * 1024,
    });
    const writeStream = fs.createWriteStream(outputPath, { encoding: "utf8" });

    let buffer = "";
    let foundForkLine = false;
    const targetString = "may be fork";

    readStream.on("data", (chunk: string | Buffer) => {
      if (foundForkLine) {
        // Stop processing once we've found the fork line
        return;
      }

      const chunkStr =
        typeof chunk === "string" ? chunk : chunk.toString("utf8");
      buffer += chunkStr;

      // Process complete lines
      const lines = buffer.split("\n");
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanedLine = stripAnsi(line);
        writeStream.write(cleanedLine + "\n");

        // Check if this line contains "may be fork..."
        if (cleanedLine.toLowerCase().includes(targetString)) {
          foundForkLine = true;
          // Stop processing after this line
          readStream.destroy();
          writeStream.end();
          return;
        }
      }
    });

    readStream.on("end", () => {
      // Process any remaining content in buffer
      if (buffer && !foundForkLine) {
        const cleanedBuffer = stripAnsi(buffer);
        writeStream.write(cleanedBuffer);
      }
      writeStream.end();
    });

    writeStream.on("finish", () => {
      resolve();
    });

    readStream.on("error", (error) => {
      writeStream.destroy();
      reject(error);
    });

    writeStream.on("error", (error) => {
      readStream.destroy();
      reject(error);
    });

    readStream.on("close", () => {
      if (!writeStream.destroyed) {
        writeStream.end();
      }
    });
  });
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
    level: process.env.LOG_LEVEL || "info",
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

export interface TestLogOptions {
  fileLogging: boolean;
  testName: string;
  verboseLogging: boolean;
  logLevel: string;
}

/**
 * Create a test logger with file output and filtering
 */
export const createTestLogger = (options: TestLogOptions) => {
  let logStream: fs.WriteStream | undefined;
  let logFileName = "";

  if (options.fileLogging) {
    const logsDir = "logs";
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const cleanTestName = path
      .basename(options.testName)
      .replace(/\.test\.ts$/, "");
    logFileName = `raw-${cleanTestName}-${getTime()}.log`;

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

export class ProgressBar {
  private total: number;
  private current = 0;
  private label: string;
  private lastUpdate = Date.now();
  private isUpdating = false;

  constructor(total: number, label = "") {
    this.total = total;
    this.label = label;
  }

  update(current?: number) {
    // Prevent concurrent updates
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      if (current !== undefined) this.current = current;
      else this.current++;

      const now = Date.now();
      // Always show progress for 0 or when complete, otherwise throttle updates
      if (
        now - this.lastUpdate < 100 &&
        this.current > 0 &&
        this.current < this.total
      ) {
        this.isUpdating = false;
        return;
      }
      this.lastUpdate = now;

      const pct = Math.round((this.current / Math.max(1, this.total)) * 100);
      const filled = Math.round((this.current / Math.max(1, this.total)) * 40);
      const bar =
        "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, 40 - filled));

      process.stdout.write(
        `\r${this.label} [${bar}] ${pct}% (${this.current}/${this.total})`,
      );

      if (this.current >= this.total) process.stdout.write("\n");
    } finally {
      this.isUpdating = false;
    }
  }

  finish() {
    this.current = this.total;
    this.update();
  }
}
