import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { sendDatadogLog } from "@helpers/datadog";
import { createTestLogger } from "@helpers/logger";
import "dotenv/config";

/**
 * Configuration for test retry behavior and logging
 */
interface TestOptions {
  attempts: number; // Maximum retry attempts (default: 1)
  retryDelay: number; // Delay between retries (seconds)
  enableLogging: boolean; // Enable file logging
  customLogFile?: string; // Custom log filename
  env: string; // Environment to run the test in
  vitestArgs: string[]; // Additional vitest arguments
  noFail: boolean; // Exit 0 even on failure
  verboseLogging: boolean; // Show terminal output
  parallel: boolean; // Run tests in parallel
  cleanLogs: boolean; // Auto-clean logs after completion
  logLevel: string; // Log level (info, info, error)
  noErrorLogs: boolean; // Disable sending error logs to Datadog
  reportForkCount: boolean; // Report fork count after ansi:forks
}

/**
 * Runs ansi:forks and optionally reports fork count
 */
function runAnsiForksAndReport(options: TestOptions): void {
  if (options.reportForkCount) {
    console.info("Running ansi:forks...");
    try {
      execSync("yarn ansi:forks", { stdio: "inherit" });
      console.info("Finished cleaning up");

      const logsDir = path.join(process.cwd(), "logs", "cleaned");
      if (fs.existsSync(logsDir)) {
        const forkCount = fs.readdirSync(logsDir).length;
        console.info(`Found ${forkCount} forks in logs/cleaned`);
      } else {
        console.info("No logs/cleaned directory found");
      }
    } catch (error) {
      console.error("Failed to run ansi:forks:", error);
    }
  }
}

async function cleanSpecificLogFile(
  logFileName: string,
  pattern?: string,
): Promise<void> {
  if (!logFileName) {
    console.info("No log file name provided for cleaning");
    return;
  }

  const logsDir = path.join(process.cwd(), "logs");
  let outputPath: string;
  const rawFilePath = path.join(logsDir, logFileName);

  // Check if the raw file exists
  if (!fs.existsSync(rawFilePath)) {
    console.info(`Raw log file not found: ${rawFilePath}`);
    return;
  }

  if (pattern) {
    // If a pattern is provided, use logs/cleaned/cleaned-<original>.log with pattern detection
    const outputDir = path.join(logsDir, "cleaned");
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }
    const outputFileName = `cleaned-${logFileName}`;
    outputPath = path.join(outputDir, outputFileName);

    try {
      // Import processLogFile dynamically to avoid circular dependencies
      const { processLogFile } = await import("@helpers/logger");
      await processLogFile(rawFilePath, outputPath);
      console.info(`Cleaned log file: ${logFileName} -> ${outputPath}`);
    } catch (error) {
      console.error(`Failed to clean log file ${logFileName}:`, error);
    }
  } else {
    // Default: simple ANSI cleaning without pattern detection using streaming
    try {
      const { stripAnsi } = await import("@helpers/logger");

      // Use streaming to avoid memory issues with large files
      const readStream = fs.createReadStream(rawFilePath, {
        encoding: "utf8",
        highWaterMark: 64 * 1024, // 64KB chunks
      });

      const tempPath = `${rawFilePath}.tmp`;
      const writeStream = fs.createWriteStream(tempPath, { encoding: "utf8" });

      readStream.on("data", (chunk: string | Buffer) => {
        const chunkStr =
          typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const cleanedChunk = stripAnsi(chunkStr);
        writeStream.write(cleanedChunk);
      });

      await new Promise<void>((resolve, reject) => {
        readStream.on("end", () => {
          writeStream.end();
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

        writeStream.on("finish", () => {
          resolve();
        });
      });

      // Replace the original file with the cleaned version
      await fs.promises.unlink(rawFilePath);
      await fs.promises.rename(tempPath, rawFilePath);

      console.info(logFileName);
    } catch (error) {
      console.error(`Failed to clean ANSI codes from ${logFileName}:`, error);
    }
  }
}

/**
 * Parses test command arguments and options
 * Handles both simple test runs and advanced retry mode
 *
 * @param args - Command line arguments
 * @returns Parsed test name and retry options
 */
function parseTestArgs(args: string[]): {
  testName: string;
  options: TestOptions;
} {
  let testName = "functional";
  const options: TestOptions = {
    attempts: 1, // Default to 1 attempt (no retry)
    retryDelay: 10,
    enableLogging: false, // Default to no file logging
    env: "local",
    vitestArgs: [],
    noFail: false,
    verboseLogging: true, // Show terminal output by default
    parallel: false,
    cleanLogs: true,
    logLevel: "off", // Default log level
    noErrorLogs: false,
    reportForkCount: false, // Report fork count after ansi:forks
  };

  let currentArgs = [...args];
  if (currentArgs.length > 0 && !currentArgs[0].startsWith("--")) {
    const shiftedArg = currentArgs.shift();
    testName = shiftedArg || "functional";
  }

  for (let i = 0; i < currentArgs.length; i++) {
    const arg = currentArgs[i];
    const nextArg = currentArgs[i + 1];

    switch (arg) {
      case "--attempts":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            options.attempts = val;
          } else {
            console.warn(`Invalid value for --attempts: ${nextArg}`);
          }
          i++;
        }
        break;
      case "--versions":
        if (nextArg) {
          // Store versions in vitestArgs to be passed as environment variable
          options.vitestArgs.push(`--versions=${nextArg}`);
          i++;
        } else {
          console.warn("--versions flag requires a value (e.g., --versions 3)");
        }
        break;
      case "--debug":
        options.enableLogging = true;
        options.verboseLogging = false;
        break;
      case "--nodeVersion":
        if (nextArg) {
          // Store node version in vitestArgs to be passed as environment variable
          options.vitestArgs.push(`--nodeVersion=${nextArg}`);
          i++;
        } else {
          console.warn(
            "--nodeVersion flag requires a value (e.g., --nodeVersion 3.1.1)",
          );
        }
        break;
      case "--no-error-logs":
        options.noErrorLogs = true;
        break;
      case "--no-fail":
        options.noFail = true;
        break;
      case "--parallel":
        options.parallel = true;
        break;
      case "--env":
        if (nextArg) {
          options.env = nextArg;
          options.vitestArgs.push(`--env=${nextArg}`);
          i++;
        } else {
          console.warn("--env flag requires a value (e.g., --env local)");
        }
        break;
      case "--sync":
        if (nextArg) {
          options.vitestArgs.push(`--sync=${nextArg}`);
          i++;
        } else {
          console.warn(
            "--sync flag requires a value (e.g., --sync all,conversations)",
          );
        }
        break;
      case "--size":
        if (nextArg) {
          // Store batch size in vitestArgs to be passed as environment variable
          options.vitestArgs.push(`--size=${nextArg}`);
          i++;
        } else {
          console.warn("--size flag requires a value (e.g., --size 5-10)");
        }
        break;
      case "--forks":
        options.reportForkCount = true;
        break;
      default:
        options.vitestArgs.push(arg);
    }
  }

  return { testName, options };
}

/**
 * Process environment variables from vitestArgs
 */
function processEnvironmentVariables(
  options: TestOptions,
): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env,
    RUST_BACKTRACE: "1",
  };

  // Extract --versions parameter and set as environment variable
  const versionsArg = options.vitestArgs.find((arg) =>
    arg.startsWith("--versions="),
  );
  if (versionsArg) {
    const versions = versionsArg.split("=")[1];
    env.TEST_VERSIONS = versions;
  }

  // Extract --nodeVersion parameter and set as environment variable
  const nodeVersionArg = options.vitestArgs.find((arg) =>
    arg.startsWith("--nodeVersion="),
  );
  if (nodeVersionArg) {
    const nodeVersion = nodeVersionArg.split("=")[1];
    env.NODE_VERSION = nodeVersion;
  }

  // Extract --env parameter and set as environment variable
  const envArg = options.vitestArgs.find((arg) => arg.startsWith("--env="));
  if (envArg) {
    const envValue = envArg.split("=")[1];
    env.XMTP_ENV = envValue;
    process.env.XMTP_ENV = envValue;
  }

  // Extract --sync parameter and set as environment variable
  const syncArg = options.vitestArgs.find((arg) => arg.startsWith("--sync="));
  if (syncArg) {
    const syncValue = syncArg.split("=")[1];
    env.SYNC_STRATEGY = syncValue;
  }

  // Extract --size parameter and set as environment variable
  const sizeArg = options.vitestArgs.find((arg) => arg.startsWith("--size="));
  if (sizeArg) {
    const sizeValue = sizeArg.split("=")[1];
    env.BATCH_SIZE = sizeValue;
  }

  // Set logging level
  env.LOGGING_LEVEL = options.logLevel || "error";

  // Remove custom args from vitestArgs since they're not vitest parameters
  options.vitestArgs = options.vitestArgs.filter(
    (arg) =>
      !arg.startsWith("--versions=") &&
      !arg.startsWith("--nodeVersion=") &&
      !arg.startsWith("--env=") &&
      !arg.startsWith("--sync=") &&
      !arg.startsWith("--size="),
  );

  return env;
}

/**
 * Collects all test parameters into a single object for comprehensive logging
 */
function collectTestParameters(
  testName: string,
  options: TestOptions,
  env: Record<string, string>,
): Record<string, any> {
  const parameters: Record<string, any> = {
    testName,
    attempts: options.attempts,
    retryDelay: options.retryDelay,
    enableLogging: options.enableLogging,
    verboseLogging: options.verboseLogging,
    parallel: options.parallel,
    cleanLogs: options.cleanLogs,
    logLevel: options.logLevel,
    noFail: options.noFail,
    noErrorLogs: options.noErrorLogs,
    reportForkCount: options.reportForkCount,
    vitestArgs: options.vitestArgs,
  };

  // Add environment variables that were set
  if (env.TEST_VERSIONS) parameters.testVersions = env.TEST_VERSIONS;
  if (env.NODE_VERSION) parameters.nodeVersion = env.NODE_VERSION;
  if (env.XMTP_ENV) parameters.xmtpEnv = env.XMTP_ENV;
  if (env.SYNC_STRATEGY) parameters.syncStrategy = env.SYNC_STRATEGY;
  if (env.BATCH_SIZE) parameters.batchSize = env.BATCH_SIZE;
  if (env.LOGGING_LEVEL) parameters.loggingLevel = env.LOGGING_LEVEL;

  return parameters;
}

/**
 * Logs all test parameters in a comprehensive format
 */
function logTestParameters(parameters: Record<string, any>): void {
  console.info("=== TEST PARAMETERS ===");
  Object.entries(parameters).forEach(([key, value]) => {
    console.info(`${key}: ${JSON.stringify(value)}`);
  });
  console.info("=======================");
}

async function runCommand(
  command: string,
  env: Record<string, string>,
  logger?: ReturnType<typeof createTestLogger>,
): Promise<{ exitCode: number; errorOutput: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let errorOutput = "";

    child.stdout?.on("data", (data: Buffer) => {
      if (logger) {
        logger.processOutput(data);
      } else {
        process.stdout.write(data);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const errorText = data.toString();
      errorOutput += errorText;
      if (logger) {
        logger.processOutput(data);
      } else {
        process.stderr.write(data);
      }
    });

    child.on("close", (code) => {
      resolve({ exitCode: code || 0, errorOutput });
    });

    child.on("error", (error) => {
      console.error(`Failed to start command: ${error.message}`);
      resolve({ exitCode: 1, errorOutput: error.message });
    });
  });
}

async function runTest(testName: string, options: TestOptions): Promise<void> {
  const logger = createTestLogger({
    enableLogging: options.enableLogging,
    testName,
    verboseLogging: options.verboseLogging,
    logLevel: options.logLevel,
  });

  const env = processEnvironmentVariables(options);
  const parameters = collectTestParameters(testName, options, env);
  logTestParameters(parameters);

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    console.info(`Attempt ${attempt} of ${options.attempts}...`);

    try {
      const defaultThreadingOptions = options.parallel
        ? "--pool=forks"
        : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";
      const command =
        `npx vitest run ${testName} ${defaultThreadingOptions} ${options.vitestArgs.join(" ")}`.trim();

      console.info(`Executing: ${command}`);

      const { exitCode } = await runCommand(command, env, logger);

      if (exitCode === 0) {
        console.info("Tests passed successfully!");
        logger?.close();

        // Clean the log file if enabled
        if (options.cleanLogs && logger?.logFileName) {
          await cleanSpecificLogFile(logger.logFileName);
        }

        // Run ansi:forks after successful test completion
        runAnsiForksAndReport(options);

        return;
      } else {
        console.info("Tests failed!");
      }

      if (attempt === options.attempts) {
        console.error(
          `\n❌ Test suite "${testName}" failed after ${options.attempts} attempts.`,
        );

        if (
          options.enableLogging &&
          !options.noErrorLogs &&
          logger?.logFileName
        ) {
          await sendDatadogLog(logger.logFileName, testName);
        }

        logger?.close();

        // Clean the log file if enabled (even for failed tests)
        if (options.cleanLogs && logger?.logFileName) {
          await cleanSpecificLogFile(logger.logFileName);
        }

        if (options.noFail) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      }

      if (options.retryDelay > 0) {
        console.info(`\n⏳ Retrying in ${options.retryDelay} seconds...`);
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          options.retryDelay * 1000,
        );
      } else {
        console.info("\n🔄 Retrying immediately...");
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`);
      console.error(error);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle both formats:
  // 1. yarn test test performance --env local (with command type)
  // 2. yarn test performance --env local (direct call)
  let commandType: string;
  let testArgs: string[];

  if (args[0] === "test") {
    // Format 1: yarn test test performance --env local
    commandType = args[0];
    testArgs = args.slice(1);
  } else {
    // Format 2: yarn test performance --env local (direct call)
    commandType = "test";
    testArgs = args;
  }

  try {
    switch (commandType) {
      case "test": {
        const { testName, options } = parseTestArgs(testArgs);

        // Check if this is a simple test run (no retry options)
        const isSimpleRun =
          options.attempts === 1 && !options.enableLogging && !options.noFail;

        if (isSimpleRun) {
          // Process environment variables for simple runs
          const env = processEnvironmentVariables(options);

          // Run test directly without logger for native terminal output
          const defaultThreadingOptions = options.parallel
            ? "--pool=forks"
            : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";
          const command =
            `npx vitest run ${testName} ${defaultThreadingOptions} ${options.vitestArgs.join(" ")}`.trim();

          console.info(`Executing: ${command}`);
          execSync(command, { stdio: "inherit", env });
        } else {
          // Use retry mechanism with logger
          await runTest(testName, options);
        }
        break;
      }

      default: {
        console.error(`Unknown command type: ${commandType}`);
        console.error("This CLI only supports 'test' command type.");
        process.exit(1);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error executing command: ${message}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
