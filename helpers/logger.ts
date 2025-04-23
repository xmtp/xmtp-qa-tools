import fs from "fs";
import path from "path";
import type { ExpectStatic } from "vitest";
import winston from "winston";
import Transport from "winston-transport";
import type { LogInfo } from "./tests";

class MemoryTransport extends Transport {
  logs: string[] = [];
  log(info: LogInfo, callback: () => void) {
    // Ensure the formatted message is available
    const formattedMessage = String(
      info[Symbol.for("message")] ||
        `[${info.timestamp}] [${info.level}] ${info.message}`,
    );
    this.logs.push(formattedMessage);
    setImmediate(() => this.emit("logged", info));
    callback();
  }
  flush(filePath: string) {
    // Write all logs at once
    fs.writeFileSync(filePath, this.logs.join("\n"), { flag: "w" });
    this.logs = [];
  }
}

let sharedLogger: winston.Logger | null = null;
let memoryTransport: MemoryTransport | null = null;
// Export a flush function to flush the memory transport logs
export const flushLogger = (testName: string): string => {
  if (memoryTransport) {
    const logFilePath = getLogFilePath(testName);
    memoryTransport.flush(logFilePath);
    return logFilePath;
  }
  return "";
};
// Add this function to capture external process output
export const captureProcessOutput = (
  stdout: string,
  stderr: string,
  logger: winston.Logger,
) => {
  if (stdout) {
    stdout.split("\n").forEach((line) => {
      if (line.trim()) logger.log("info", `[Rust] ${line.trim()}`);
    });
  }

  if (stderr) {
    stderr.split("\n").forEach((line) => {
      if (line.trim()) logger.log("error", `[Rust] ${line.trim()}`);
    });
  }
};
export const createLogger = (testName: string) => {
  if (!sharedLogger) {
    const logFilePath = getLogFilePath(testName);
    // Shared format for console and memory transport
    const sharedFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp as string}] [${level}] ${message as string}`;
      }),
    );

    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), sharedFormat),
    });

    // Initialize our custom memory transport
    memoryTransport = new MemoryTransport({
      format: sharedFormat,
    });

    sharedLogger = winston.createLogger({
      transports: [consoleTransport, memoryTransport],
    });

    // Optionally, catch termination signals to flush logs before exit
    const flushAndExit = () => {
      if (memoryTransport) {
        memoryTransport.flush(logFilePath);
      }
      process.exit();
    };
    process.on("exit", flushAndExit);
    process.on("SIGINT", flushAndExit);
    process.on("SIGTERM", flushAndExit);
  }

  return sharedLogger;
};

function filterLog(args: unknown[]): string {
  // First, check if this is a SQLCipher memory lock related log
  const logStr = args.join(" ").toString();
  if (
    logStr.includes("sqlcipher_mem_lock") ||
    logStr.includes("SQLCIPHER_NO_MLOCK")
  ) {
    return ""; // Skip these logs entirely
  }

  // Check for the console.time/timeEnd pattern: where args[0] is "%s: %s"

  if (!process.env.CI) {
    if (args.length >= 2 && args[0] === "%s: %s") {
      // Join the remaining parts into one message
      const message = args.slice(1).join(" ");
      const timePattern = /(\d+(\.\d+)?)(ms|s)\b/;
      const match = message.match(timePattern);
      if (match) {
        const timeValue = parseFloat(match[1]);
        const unit = match[3];
        const timeInMs = unit === "ms" ? timeValue : timeValue * 1000;
        // Skip logs for durations less than or equal to 300ms
        if (timeInMs <= 300) {
          return "";
        }
      }
      // Remove any "%s" placeholders from the message.
      return message.replace(/%s/g, "").trim();
    }
  } else {
    if (args.length >= 2 && args[0] === "%s: %s") {
      return "";
    }
  }

  return (
    args
      .map((arg) => {
        if (arg === null) return "null";
        if (arg === undefined) return "undefined";
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e: unknown) {
            if (e instanceof Error) {
              return e.message;
            }
            return "[Circular Object]";
          }
        }
        return arg as string;
      })
      .filter(Boolean)
      .join(" ")
      .trim() || ""
  );
}
const getLogFilePath = (testName: string): string => {
  const logName = testName;
  const sanitizedName = logName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = `${sanitizedName}.log`;

  return testName.includes("bug")
    ? path.join("bugs", logName, "test.log")
    : path.join("logs", fileName);
};

export const overrideConsole = (logger: winston.Logger) => {
  try {
    console.log = (...args: unknown[]) => {
      const message = filterLog(args);
      if (message) {
        // If this is a console.time/end log, always use warn if duration > 300ms.
        if (args.length >= 2 && args[0] === "%s: %s") {
          logger.log("warn", message);
        } else {
          logger.log("info", message);
        }
      }
    };
    console.info = (...args: unknown[]) => {
      const message = filterLog(args);
      if (message) {
        // Also promote timing logs from console.info to warn.
        if (args.length >= 2 && args[0] === "%s: %s") {
          logger.log("warn", message);
        } else {
          logger.log("info", message);
        }
      }
    };
    console.warn = (...args: unknown[]) => {
      const message = filterLog(args);
      if (message) {
        logger.log("warn", message);
      }
    };
    console.error = (...args: unknown[]) => {
      const message = filterLog(args);
      if (message) {
        logger.log("error", message);
      }
    };

    console.debug = (...args: unknown[]) => {
      if (!process.env.CI) {
        // Using a specific function type for console.debug
        const originalConsoleDebug = Function.prototype.bind.call(
          console.constructor.prototype.debug as (...args: unknown[]) => void,
          console,
        );
        originalConsoleDebug(...args);
      }
    };
  } catch (error) {
    console.error("Error overriding console", error);
  }
};

if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

export const logError = (e: unknown, expect: ExpectStatic): boolean => {
  if (e instanceof Error) {
    console.error(
      `[vitest] Test failed in ${expect.getState().currentTestName}`,
      e.message,
    );
  } else {
    console.error(`Unknown error type:`, typeof e);
  }
  return true;
};

/**
 * Log a message to the console and send it to a conversation
 * @param message The message to log and send
 * @param conversation The conversation to send the message to
 * @param level The log level (default: 'info')
 * @returns A promise that resolves when the message is sent
 */
export const logAndSend = async (
  message: string,
  conversation: any,
  level: "info" | "warn" | "error" = "info",
): Promise<void> => {
  // Log to console based on level
  switch (level) {
    case "warn":
      console.warn(message);
      break;
    case "error":
      console.error(message);
      break;
    default:
      console.log(message);
  }

  // Send to conversation if provided
  if (conversation && typeof conversation.send === "function") {
    await conversation.send(message);
  }
};

/**
 * Log an error to the console and send it to a conversation
 * @param error The error object or string
 * @param conversation The conversation to send the error to
 * @param context Optional context message to prefix the error
 * @returns A promise that resolves when the error is sent
 */
export const logAndSendError = async (
  error: unknown,
  conversation: any,
  context: string = "Error",
): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return logAndSend(`⚠️ ${context}: ${errorMessage}`, conversation, "error");
};

/**
 * Log a status update with timestamp to console and send to conversation
 * @param message The status message
 * @param conversation The conversation to send the status to
 * @param emoji Optional emoji to prefix the message (default: '🔄')
 * @returns A promise that resolves when the status is sent
 */
export const logAndSendStatus = async (
  message: string,
  conversation: any,
  emoji: string = "🔄",
): Promise<void> => {
  const timestamp = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  return logAndSend(`${emoji} [${timestamp}] ${message}`, conversation);
};

export const removeDB = (fileName: string) => {
  const testFilePath = fileName.split("/").slice(0, -1).join("/") + "/";
  console.log("testFilePath", fileName, testFilePath);
  fs.rmSync(".data", { recursive: true, force: true });
};
