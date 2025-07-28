import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { sendDatadogLog } from "@helpers/datadog";
import { createTestLogger } from "@helpers/logger";
import "dotenv/config";
import {
  checkForCriticalErrors,
  extractErrorLogs,
  extractfail_lines,
} from "@helpers/analyzer";

/**
 * Configuration for test retry behavior and logging
 */
interface TestOptions {
  attempts: number; // Maximum retry attempts (default: 1)
  retryDelay: number; // Delay between retries (seconds)
  fileLogging: boolean; // Enable file logging
  vitestArgs: string[]; // Additional vitest arguments
  noFail: boolean; // Exit 0 even on failure
  verboseLogging: boolean; // Show terminal output
  parallel: boolean; // Run tests in parallel
  sendToDatadog: boolean; // Disable sending error logs to Datadog
  reportForkCount: boolean; // Report fork count after ansi:forks
}

function showHelp() {
  console.log(`
XMTP Test CLI - Test suite execution and management

USAGE:
  yarn test <test-suite> [options]

ARGUMENTS:
  test-suite             Test suite name (functional, convos, groups, etc.)

OPTIONS:
  --env <environment>    XMTP environment (local, dev, production) [default: local]
  --attempts <number>    Maximum retry attempts [default: 3]
  --debug               Enable file logging (saves to logs/ directory)
  --no-fail             Exit with success code even on failures
  --parallel            Run tests in parallel (default: consecutive)
  --versions <count>    Use multiple SDK versions for testing
  -h, --help            Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

TEST SUITES:
  functional     Complete functional test suite
  convos         Direct message tests
  groups         Group conversation tests
  performance    Core performance metrics and large groups  
  delivery       Message delivery reliability
  bench          Benchmarking suite
  browser        Playwright browser automation
  agents         Live bot monitoring
  networkchaos   Network partition tolerance
  other          Security, spam detection, rate limiting
  forks          Git commit-based testing

EXAMPLES:
  yarn test functional --env dev --debug
  yarn test convos --no-fail --parallel
  yarn test performance --versions 3
  yarn test --help

For more information, see: cli/readme.md
`);
}

/**
 * Runs ansi:forks and optionally reports fork count
 */
function runAnsiForksAndReport(): void {
  console.info("Running ansi:forks...");
  try {
    execSync("yarn ansi:forks", { stdio: "inherit" });
    console.info("Finished cleaning up");

    const logsDir = path.join(process.cwd(), "logs", "cleaned");
    if (fs.existsSync(logsDir)) {
      const forkCount = fs.readdirSync(logsDir).length;
      console.info(`Found ${forkCount} forks in logs/cleaned`);
      if (forkCount > 0) {
        process.exit(1);
      }
      // Remove the cleaned folder if it's empty
      if (forkCount === 0) {
        fs.rmdirSync(logsDir);
        console.info("Removed empty logs/cleaned directory");
      }
    } else {
      console.info("No logs/cleaned directory found");
    }
  } catch (error) {
    console.error("Failed to run ansi:forks:", error);
  }
}

async function cleanSpecificLogFile(
  logFileName: string,
  pattern?: string,
): Promise<void> {
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
    const outputFileName = `cleaned-${logFileName}`;
    outputPath = path.join(outputDir, outputFileName);

    try {
      // Import processLogFile dynamically to avoid circular dependencies
      const { processLogFile } = await import("@helpers/logger");
      await processLogFile(rawFilePath, outputPath);
      console.info(`Cleaned log file: ${logFileName} -> ${outputPath}`);
    } catch (error) {
      console.error(`Failed to clean log file ${logFileName}:`, error);
      // If processing failed, remove the cleaned folder if it's empty
      if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length === 0) {
        await fs.promises.rmdir(outputDir);
      }
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
 * Parses test command arguments and options, setting environment variables directly
 * Handles both simple test runs and advanced retry mode
 *
 * @param args - Command line arguments
 * @returns Parsed test name, options, and environment variables
 */
function parseTestArgs(args: string[]): {
  testName: string;
  options: TestOptions;
  env: Record<string, string>;
} {
  let testName = "functional";
  const options: TestOptions = {
    attempts: 1, // Default to 1 attempt (no retry)
    retryDelay: 1,
    fileLogging: false,
    vitestArgs: [],
    noFail: false,
    verboseLogging: false, // Show terminal output by default
    parallel: false,
    sendToDatadog: true,
    reportForkCount: false, // Report fork count after ansi:forks
  };

  // Initialize environment variables
  const env: Record<string, string> = {
    ...process.env,
    RUST_BACKTRACE: "1",
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
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
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
          env.TEST_VERSIONS = nextArg;
          i++;
        } else {
          console.warn("--versions flag requires a value (e.g., --versions 3)");
        }
        break;
      case "--debug":
        options.fileLogging = true;
        env.LOGGING_LEVEL = "debug";
        break;
      case "--nodeSDK":
        if (nextArg) {
          env.NODE_VERSION = nextArg;
          i++;
        } else {
          console.warn(
            "--nodeSDK flag requires a value (e.g., --nodeSDK 3.1.1)",
          );
        }
        break;
      case "--no-datadog":
        options.sendToDatadog = false;
        break;
      case "--no-fail":
        options.noFail = true;
        break;
      case "--parallel":
        options.parallel = true;
        break;
      case "--env":
        if (nextArg) {
          env.XMTP_ENV = nextArg;
          i++;
        } else {
          console.warn("--env flag requires a value (e.g., --env local)");
        }
        break;
      case "--sync":
        if (nextArg) {
          env.SYNC_STRATEGY = nextArg;
          i++;
        } else {
          console.warn(
            "--sync flag requires a value (e.g., --sync all,conversations)",
          );
        }
        break;
      case "--size":
        if (nextArg) {
          env.BATCH_SIZE = nextArg;
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

  return { testName, options, env };
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

async function runTest(
  testName: string,
  options: TestOptions,
  env: Record<string, string>,
): Promise<void> {
  console.info(`\n🧪 Test Suite: ${testName}`);
  console.info(`   Environment: ${env.XMTP_ENV || "local"}`);
  console.info(
    `   Configuration: ${options.parallel ? "Parallel" : "Sequential"} execution`,
  );
  console.info(`   Max Attempts: ${options.attempts}`);
  console.info(
    `   File Logging: ${options.fileLogging ? "Enabled" : "Disabled"}`,
  );

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    console.info(`\n📋 Attempt ${attempt} of ${options.attempts}...`);

    if (attempt > 1) {
      console.info(`   ⏳ Retry delay: ${options.retryDelay} seconds`);
    }

    // Create a new logger for each attempt
    const logger = createTestLogger({
      fileLogging: options.fileLogging,
      testName,
      verboseLogging: options.verboseLogging,
      logLevel: env.LOGGING_LEVEL,
    });

    try {
      const defaultThreadingOptions = options.parallel
        ? "--pool=forks"
        : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";
      const command =
        `npx vitest run ${testName} ${defaultThreadingOptions} ${options.vitestArgs.join(" ")}`.trim();

      console.info(`   🚀 Executing: ${command}`);

      const { exitCode } = await runCommand(command, env, logger);

      console.info(`   📊 Execution Results:`);
      if (exitCode === 0) {
        console.info(`      ✅ Tests passed successfully!`);
      } else {
        console.info(`      ❌ Tests failed with exit code: ${exitCode}`);
      }

      // Close logger for this attempt
      logger?.close();

      await cleanSpecificLogFile(logger.logFileName);

      // Check if this was the last attempt
      if (attempt === options.attempts) {
        console.info(`\n📈 Test Suite Summary:`);
        console.info(`   🎯 Test Suite: ${testName}`);
        console.info(`   📝 Completed ${options.attempts} attempts`);
        console.info(`   📁 Log File: ${logger.logFileName}`);

        const errorLogs = extractErrorLogs(testName);
        const fail_lines = extractfail_lines(errorLogs);
        checkForCriticalErrors(testName, fail_lines);

        console.info(`\n🔍 Error Analysis:`);
        if (!errorLogs || errorLogs.size === 0) {
          console.info(`   ℹ️  No error logs found - skipping analysis`);
          return;
        }

        console.info(`   📊 Found ${errorLogs.size} unique error patterns:`);
        Array.from(errorLogs).forEach((error, index) => {
          console.info(`      ${index + 1}. ${error}`);
        });

        if (Array.isArray(fail_lines) && fail_lines.length === 0) {
          console.info(`   ℹ️  No fail_lines logs found - skipping analysis`);
          return;
        }

        // Handle failed attempt (only for non-final attempts)
        if (attempt < options.attempts && exitCode !== 0) {
          console.error(
            `\n❌ Test suite "${testName}" failed on attempt ${attempt} of ${options.attempts}.`,
          );
        }

        if (options.reportForkCount) {
          console.info(`\n🔧 Running fork analysis...`);
          runAnsiForksAndReport();
        }

        if (options.sendToDatadog) {
          console.info(`\n📊 Sending logs to Datadog...`);
          await sendDatadogLog(Array.from(errorLogs), fail_lines, testName);
          console.info(`   ✅ Logs sent successfully`);
        }

        console.info(`\n🏁 Final Status:`);
        // Exit based on the last attempt's result
        if (exitCode === 0 || options.noFail) {
          console.info(`   ✅ Test suite completed successfully`);
          process.exit(0);
        } else {
          console.info(`   ❌ Test suite failed`);
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
      console.error(`\n💥 Attempt ${attempt} failed with exception:`);
      console.error(`   Error: ${String(error)}`);

      // Close logger for this attempt
      logger?.close();
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
        const { testName, options, env } = parseTestArgs(testArgs);

        // Check if this is a simple test run (no retry options)
        // Simple run: single attempt, no file logging, no noFail flag
        const isSimpleRun =
          options.attempts === 1 && !options.fileLogging && !options.noFail;

        if (isSimpleRun) {
          // Run test directly without logger for native terminal output
          console.info(`\n🧪 Test Suite: ${testName}`);
          console.info(`   Environment: ${env.XMTP_ENV || "local"}`);
          console.info(`   Configuration: Simple run (direct execution)`);

          const defaultThreadingOptions = options.parallel
            ? "--pool=forks"
            : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";
          const command =
            `npx vitest run ${testName} ${defaultThreadingOptions} ${options.vitestArgs.join(" ")}`.trim();

          console.info(`\n🚀 Executing: ${command}`);
          execSync(command, { stdio: "inherit", env });
        } else {
          // Use retry mechanism with logger
          await runTest(testName, options, env);
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
