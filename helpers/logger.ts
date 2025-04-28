import fs from "fs";
import path from "path";
import winston from "winston";

// Create a simple logger that formats logs in a pretty way
export const createLogger = () => {
  // Create a custom format that matches your desired output
  const prettyFormat = winston.format.printf((info) => {
    // Format timestamp to match [YYYY-MM-DDThh:mm:ss.sssZ]
    return `[${info.timestamp as string}] [${info.level}] ${info.message as string}`;
  });

  // Combine formats
  const combinedFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(), // Adds colors in console
    prettyFormat,
  );

  // Create the logger with console transport
  return winston.createLogger({
    format: combinedFormat,
    transports: [new winston.transports.Console()],
  });
};

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

  // Return function to restore original console if needed
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  };
};

// Optional: Add file logging capability
export const addFileLogging = (filename: string) => {
  // Make sure logs directory exists
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Add file transport to the logger
  logger.add(
    new winston.transports.File({
      filename,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          return `[${info.timestamp as string}] [${info.level}] ${info.message as string}`;
        }),
      ),
    }),
  );
};

// Helper function to log with emoji prefixes
export const logWithEmoji = (message: string, emoji = "✓") => {
  console.log(`${emoji} ${message}`);
};
