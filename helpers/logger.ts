import fs from "fs";
import path from "path";
import winston from "winston";

// Singleton logger instance
let sharedLogger: winston.Logger | null = null;

export const createLogger = (testName: string) => {
  if (!sharedLogger) {
    const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, "_");
    // Create filename from test name
    const logFilePath = path.join("logs", `${sanitizedName}.log`);
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
    // NEW: Added console transport
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level}] ${message}`;
        }),
      ),
    });
    const sharedTransport = new winston.transports.File({
      filename: path.join("logs", `${sanitizedName}.log`),
      maxsize: 10485760,
      tailable: true,
      options: { flags: "a" }, // Change to 'a' for append mode instead of 'w'
    });

    const colorizeSlowOps = winston.format((info) => {
      if (typeof info.message === "string" && info.message.includes("XMTP:")) {
        return false;
      }

      return info;
    });

    sharedLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        colorizeSlowOps(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level}] ${message}`;
        }),
      ),
      transports: [sharedTransport, consoleTransport],
    });
  }

  return sharedLogger;
};

// Helper to override console for any module
export const overrideConsole = (logger: winston.Logger) => {
  console.log = (...args: any[]) => {
    if (
      args.length > 0 &&
      typeof args[0] === "string" &&
      args[0].includes("%s: %s")
    ) {
      filterTime(args, logger);
    } else if (Array.isArray(args)) {
      logger.info(args.join(" "));
    } else {
      logger.info(args);
    }
  };
  console.error = (...args: any[]) => logger.error(args.join(" "));
  console.warn = (...args: any[]) => logger.warn(args.join(" "));
  console.info = (...args: any[]) => logger.info(args.join(" "));
};

// Ensure logs directory exists
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}
function filterTime(args: any[], logger: winston.Logger) {
  const timePattern = /\d+(\.\d+)?ms|\d+(\.\d+)?s/;
  const timeMatch = args.find((arg: any) =>
    timePattern.test(String(arg)),
  ) as string;

  if (timeMatch) {
    const timeValue = parseFloat(timeMatch.replace(/[ms|s]/g, ""));
    // Convert seconds to milliseconds if needed
    const timeInMs = timeMatch.includes("s") ? timeValue * 1000 : timeValue;

    // Log if over 300ms
    if (timeInMs > 300) {
      logger.info(
        `${args[1]} took ${timeValue}${timeMatch.includes("s") ? "s" : "ms"}`,
      );
    }
    return true;
  }

  return false;
}
