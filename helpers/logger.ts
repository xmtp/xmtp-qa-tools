import fs from "fs";
import path from "path";
import winston, { error } from "winston";

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
    console.error(`[vitest] Test failed in ${testName}`, e.message);
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

// Optional: Add file logging capability
export const addFileLogging = (filename: string) => {
  const logPath = path.join(process.cwd(), "logs", filename + ".log");
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
