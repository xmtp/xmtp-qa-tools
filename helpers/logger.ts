import fs from "fs";
import path from "path";
import winston from "winston";
import Transport from "winston-transport";

// Custom transport that buffers logs in memory
interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}

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
  }
}

let sharedLogger: winston.Logger | null = null;
let memoryTransport: MemoryTransport | null = null;
// Export a flush function to flush the memory transport logs
export const flushLogger = (testName: string) => {
  if (memoryTransport) {
    const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const logFilePath = path.join("logs", `${sanitizedName}.log`);
    memoryTransport.flush(logFilePath);
  }
};

export const createLogger = (testName: string) => {
  if (!sharedLogger) {
    const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const logFilePath = path.join("logs", `${sanitizedName}.log`);

    // Shared format for console and memory transport
    const sharedFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [${level}] ${message}`;
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

    // Flush the buffered logs to file when the process exits normally
    process.on("exit", () => {
      if (memoryTransport) {
        memoryTransport.flush(logFilePath);
      }
    });

    // Optionally, catch termination signals to flush logs before exit
    const flushAndExit = () => {
      if (memoryTransport) {
        memoryTransport.flush(logFilePath);
      }
      process.exit();
    };
    process.on("SIGINT", flushAndExit);
    process.on("SIGTERM", flushAndExit);
  }

  return sharedLogger;
};

export const overrideConsole = (logger: winston.Logger) => {
  try {
    console.log = (...args: any[]) => {
      logger.log("info", args, logger);
    };
    console.error = (...args: any[]) => {
      logger.log("error", args, logger);
    };
    console.warn = (...args: any[]) => {
      logger.log("warn", args, logger);
    };
    console.info = (...args: any[]) => {
      logger.log("info", args, logger);
    };
  } catch (error) {
    console.error("Error overriding console", error);
  }
};

function filterTime(args: any[], logger: winston.Logger): boolean {
  const timePattern = /\d+(\.\d+)?ms|\d+(\.\d+)?s/;
  const timeMatch = args.find((arg: any) =>
    timePattern.test(String(arg)),
  ) as string;

  if (timeMatch) {
    const timeValue = parseFloat(timeMatch.replace(/[ms|s]/g, ""));
    const timeInMs = timeMatch.includes("s") ? timeValue * 1000 : timeValue;

    if (timeInMs > 300) {
      logger.warn(
        `${args[1]} took ${timeValue}${timeMatch.includes("s") ? "s" : "ms"}`,
      );
    }
    return true;
  }
  return false;
}

if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}
