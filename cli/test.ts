import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { sendDatadogLog } from "@helpers/datadog";
import { createTestLogger } from "@helpers/logger";
import "dotenv/config";

/**
 * Configuration for test retry behavior and logging
 */
interface RetryOptions {
  attempts: number; // Maximum retry attempts (default: 1)
  retryDelay: number; // Delay between retries (seconds)
  enableLogging: boolean; // Enable file logging
  customLogFile?: string; // Custom log filename
  vitestArgs: string[]; // Additional vitest arguments
  noFail: boolean; // Exit 0 even on failure
  verboseLogging: boolean; // Show terminal output
  parallel: boolean; // Run tests in parallel
  cleanLogs: boolean; // Auto-clean logs after completion
  logLevel: string; // Log level (info, info, error)
  noErrorLogs: boolean; // Disable sending error logs to Datadog
  runAnsiForks: boolean; // Run ansi:forks after test completion
  reportForkCount: boolean; // Report fork count after ansi:forks
}

/**
 * Runs ansi:forks and optionally reports fork count
 */
function runAnsiForksAndReport(options: RetryOptions): void {
  if (options.runAnsiForks) {
    console.info("Running ansi:forks...");
    try {
      execSync("yarn ansi:forks", { stdio: "inherit" });
      console.info("Finished cleaning up");

      if (options.reportForkCount) {
        const logsDir = path.join(process.cwd(), "logs", "cleaned");
        if (fs.existsSync(logsDir)) {
          const forkCount = fs.readdirSync(logsDir).length;
          console.info(`Found ${forkCount} forks in logs/cleaned`);
        } else {
          console.info("No logs/cleaned directory found");
        }
      }
    } catch (error) {
      console.error("Failed to run ansi:forks:", error);
    }
  }
}

/**
 * Expands glob patterns to actual file paths
 * Used for test file discovery (e.g., *.test.ts)
 */
function expandGlobPattern(pattern: string): string[] {
  // Simple glob expansion for *.test.ts patterns
  if (pattern.includes("*")) {
    const dir = path.dirname(pattern);
    const baseName = path.basename(pattern);

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    const regex = new RegExp(baseName.replace(/\*/g, ".*"));

    return files
      .filter((file) => regex.test(file))
      .map((file) => path.join(dir, file));
  }

  return [pattern];
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

function showUsageAndExit(): never {
  console.error("Usage: yarn test <name_or_path> [args...]");
  console.error(
    "   or (if alias 'cli' is set up): cli test <name_or_path> [args...]",
  );
  console.error("");
  console.error("Test Command:");
  console.error(
    "  test [suite_name_or_path] [options...] - Runs tests (e.g., functional)",
  );
  console.error("    Simple vitest execution (default):");
  console.error("      yarn test convos        - Runs vitest directly");
  console.error("      yarn test ./path/to/test.ts  - Runs specific test file");
  console.error("    Retry and logging options:");
  console.error(
    "      --attempts <N>  Max number of attempts for tests (default: 1)",
  );
  console.error(
    "      --parallel          Run tests in parallel (default: consecutive)",
  );
  console.error("    Logging mode (enables file logging):");
  console.error("      --info / --no-log    Enable/disable logging to file");
  console.error(
    "      --info-verbose     Enable logging to both file AND terminal output",
  );
  console.error(
    "      --info-file <n>   Custom log file name (default: auto-generated)",
  );
  console.error(
    "      --no-fail           Exit with code 0 even on test failures (still sends Slack notifications)",
  );
  console.error(
    "      --no-error-logs     Disable sending error logs to Datadog (default: enabled)",
  );
  console.error(
    "      --ansi-forks        Run ansi:forks after test completion",
  );
  console.error("      --report-forks      Report fork count after ansi:forks");
  console.error(
    "      --env <environment> Set XMTP_ENV (options: local, dev, production)",
  );
  console.error(
    "      --versions count   Number of SDK versions to use (e.g., 3)",
  );
  console.error(
    "      --nodeVersion ver  Specific Node SDK version to use (e.g., 3.1.1)",
  );
  console.error(
    "      --no-clean-logs    Disable automatic log cleaning after test completion (enabled by default)",
  );
  console.error(
    "      --log-level <level> Set logging level (info, info, error) (default: info)",
  );
  console.error(
    "      --sync <strategy>   Set sync strategy (e.g., --sync all,conversations)",
  );
  console.error(
    "      --size <range>      Set batch size range (e.g., --size 5-10)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn test functional");
  console.error("  yarn test convos --attempts 2");
  console.error("  yarn test convos --parallel");
  console.error(
    "  yarn test convos --info-verbose   # Shows output in terminal AND logs to file",
  );
  console.error("  yarn test convos --no-fail        # Exit 0 even on failure");
  console.error(
    "  yarn test convos --info        # Uses logging mode with file output",
  );
  console.error(
    "  yarn test convos --versions 3 # Uses random workers with versions 2.0.9, 2.1.0, and 2.2.0",
  );
  console.error(
    "  yarn test convos --nodeVersion 3.1.1 # Uses workers with SDK version 3.1.1",
  );
  console.error(
    "  yarn test convos --env production # Sets XMTP_ENV to production",
  );
  console.error(
    "  yarn test convos --no-clean-logs  # Disable automatic log cleaning",
  );
  console.error(
    "  yarn test convos --log-level error  # Set logging level to error",
  );
  console.error(
    "  yarn test convos --size 5-10        # Set batch size range to 5-10",
  );
  console.error(
    "  yarn test convos --attempts 100 --info --ansi-forks --report-forks  # Replicate run.sh behavior",
  );
  process.exit(1);
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
  options: RetryOptions;
} {
  let testName = "functional";
  const options: RetryOptions = {
    attempts: 1, // Default to 1 attempt (no retry)
    retryDelay: 10,
    enableLogging: false, // Default to no file logging
    vitestArgs: [],
    noFail: false,
    verboseLogging: true, // Show terminal output by default
    parallel: false,
    cleanLogs: true,
    logLevel: "info", // Default log level
    noErrorLogs: false,
    runAnsiForks: false, // Run ansi:forks after test completion
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
      case "--info":
        options.enableLogging = true;
        options.verboseLogging = false;
        break;
      case "--info-verbose":
        options.enableLogging = true;
        options.verboseLogging = true;
        break;
      case "--no-log":
        options.enableLogging = false;
        break;
      case "--info-file":
        if (nextArg) {
          options.customLogFile = nextArg;
          i++;
        }
        break;
      case "--no-fail":
        options.noFail = true;
        break;
      case "--verbose-logging":
        options.verboseLogging = true;
        break;
      case "--parallel":
        options.parallel = true;
        break;
      case "--env":
        if (nextArg) {
          options.vitestArgs.push(`--env=${nextArg}`);
          i++;
        } else {
          console.warn("--env flag requires a value (e.g., --env local)");
        }
        break;
      case "--no-clean-logs":
        options.cleanLogs = false;
        break;
      case "--log-level":
        if (nextArg) {
          options.logLevel = nextArg;
          i++;
        } else {
          console.warn(
            "--log-level flag requires a value (e.g., --log-level info)",
          );
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
      case "--no-error-logs":
        options.noErrorLogs = true;
        break;
      case "--ansi-forks":
        options.runAnsiForks = true;
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
      case "--report-forks":
        options.reportForkCount = true;
        break;
      default:
        options.vitestArgs.push(arg);
    }
  }

  return { testName, options };
}

function buildTestCommand(
  testName: string,
  vitestArgs: string[],
  parallel: boolean = false,
): string {
  const vitestArgsString = vitestArgs.join(" ");

  // Base threading options for consecutive execution
  const threadingOptions = parallel
    ? ""
    : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";

  if (testName === "functional") {
    const expandedFiles = expandGlobPattern("./suites/functional/*.test.ts");
    if (expandedFiles.length === 0) {
      throw new Error("No dmstest files found");
    }
    return `npx vitest run ${expandedFiles.join(" ")} ${threadingOptions} ${vitestArgsString}`.trim();
  }

  // Check for npm script
  const packageJsonPath = path.join(process.cwd(), "package.json");
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as {
      scripts?: Record<string, string>;
    };
    if (packageJson.scripts?.[testName]) {
      const script = packageJson.scripts[testName];

      // Handle glob patterns in scripts
      if (script.includes("*.test.ts")) {
        const globMatch = script.match(/([^\s]+\*\.test\.ts)/);
        if (globMatch) {
          const expandedFiles = expandGlobPattern(globMatch[1]);
          if (expandedFiles.length === 0) {
            throw new Error(`No test files found for pattern: ${globMatch[1]}`);
          }
          return `${script.replace(globMatch[1], expandedFiles.join(" "))} ${vitestArgsString}`.trim();
        }
      }
      return `yarn ${testName} ${vitestArgsString}`.trim();
    }
  } catch (error: unknown) {
    console.error("Error reading package.json:", error);
  }

  const defaultThreadingOptions = parallel
    ? "--pool=forks"
    : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";
  return `npx vitest run ${testName} ${defaultThreadingOptions} ${vitestArgsString}`.trim();
}

/**
 * Process environment variables from vitestArgs
 */
function processEnvironmentVariables(
  options: RetryOptions,
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
    console.info(`Setting BATCH_SIZE environment variable to: ${sizeValue}`);
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
  options: RetryOptions,
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
    runAnsiForks: options.runAnsiForks,
    reportForkCount: options.reportForkCount,
    customLogFile: options.customLogFile,
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

async function runTest(testName: string, options: RetryOptions): Promise<void> {
  const logger = options.enableLogging
    ? createTestLogger({
        enableLogging: options.enableLogging,
        customLogFile: options.customLogFile,
        testName,
        verboseLogging: options.verboseLogging,
        logLevel: options.logLevel,
      })
    : undefined;

  console.info(
    `Starting test suite: "${testName}" with up to ${options.attempts} attempts, delay ${options.retryDelay}s.`,
  );

  const env = processEnvironmentVariables(options);
  const parameters = collectTestParameters(testName, options, env);
  logTestParameters(parameters);

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    console.info(`Attempt ${attempt} of ${options.attempts}...`);

    try {
      const command = buildTestCommand(
        testName,
        options.vitestArgs,
        options.parallel,
      );
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

  if (args.length === 0) {
    showUsageAndExit();
  }

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
        await runTest(testName, options);
        break;
      }

      default: {
        console.error(`Unknown command type: ${commandType}`);
        console.error("This CLI only supports 'test' command type.");
        showUsageAndExit();
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
