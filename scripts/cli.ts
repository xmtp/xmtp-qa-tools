/**
 * XMTP QA Tools CLI
 *
 * Universal command router for running tests, bots, and scripts.
 * Provides advanced retry mechanisms, logging, and version management.
 *
 * Usage: yarn cli <command_type> <name> [options]
 *
 * Command Types:
 *   bot     - Run interactive bots (gm-bot, stress)
 *   script  - Execute utility scripts (gen, versions)
 *   test    - Run test suites with retry logic
 */

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
  maxAttempts: number; // Maximum retry attempts
  retryDelay: number; // Delay between retries (seconds)
  enableLogging: boolean; // Enable file logging
  customLogFile?: string; // Custom log filename
  vitestArgs: string[]; // Additional vitest arguments
  noFail: boolean; // Exit 0 even on failure
  explicitLogFlag: boolean; // User explicitly set logging
  verboseLogging: boolean; // Show terminal output
  jsLoggingLevel: string; // JavaScript logging level
  parallel: boolean; // Run tests in parallel
  cleanLogs: boolean; // Auto-clean logs after completion
  logLevel: string; // Log level (debug, info, error)
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
    console.debug("No log file name provided for cleaning");
    return;
  }

  const logsDir = path.join(process.cwd(), "logs");
  let outputPath: string;
  const rawFilePath = path.join(logsDir, logFileName);

  // Check if the raw file exists
  if (!fs.existsSync(rawFilePath)) {
    console.debug(`Raw log file not found: ${rawFilePath}`);
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
      console.debug(`Cleaned log file: ${logFileName} -> ${outputPath}`);
    } catch (error) {
      console.error(`Failed to clean log file ${logFileName}:`, error);
    }
  } else {
    // Default: simple ANSI cleaning without pattern detection
    try {
      const content = await fs.promises.readFile(rawFilePath, "utf8");
      const { stripAnsi } = await import("@helpers/logger");
      const cleanedContent = stripAnsi(content);
      await fs.promises.writeFile(rawFilePath, cleanedContent);
      console.debug(`Cleaned ANSI codes from log file: ${logFileName}`);
    } catch (error) {
      console.error(`Failed to clean ANSI codes from ${logFileName}:`, error);
    }
  }
}

function showUsageAndExit(): never {
  console.error("Usage: yarn cli <command_type> <name_or_path> [args...]");
  console.error(
    "   or (if alias 'cli' is set up): cli <command_type> <name_or_path> [args...]",
  );
  console.error("");
  console.error("Command Types:");
  console.error(
    "  bot <bot_name> [bot_args...]        - Runs a bot (e.g., gm-bot)",
  );
  console.error(
    "  script <script_name> [script_args...] - Runs a script (e.g., gen)",
  );
  console.error(
    "  test [suite_name_or_path] [options...] - Runs tests (e.g., functional)",
  );
  console.error("    Simple vitest execution (default):");
  console.error("      yarn cli test dms        - Runs vitest directly");
  console.error(
    "      yarn cli test ./path/to/test.ts  - Runs specific test file",
  );
  console.error("    Retry mode (when retry options are present):");
  console.error(
    "      --max-attempts <N>  Max number of attempts for tests (default: 3)",
  );
  console.error(
    "      --retry-delay <S>   Delay in seconds between retries (default: 10)",
  );
  console.error(
    "      --parallel          Run tests in parallel (default: consecutive)",
  );
  console.error(
    "      --debug / --no-log    Enable/disable logging to file (default: enabled)",
  );
  console.error(
    "      --debug-verbose     Enable logging to both file AND terminal output",
  );
  console.error(
    "      --debug-file <n>   Custom log file name (default: auto-generated)",
  );
  console.error(
    "      --no-fail           Exit with code 0 even on test failures (still sends Slack notifications)",
  );
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
    "      --log-level <level> Set logging level (debug, info, error) (default: debug)",
  );
  console.error(
    "      --sync <strategy>   Set sync strategy (e.g., --sync all,conversations)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli bot stress 5");
  console.error("  yarn cli script gen");
  console.error("  yarn script versions");
  console.error("  yarn cli test functional");
  console.error("  yarn cli test dms --max-attempts 2");
  console.error("  yarn cli test dms --parallel");
  console.error(
    "  yarn cli test dms --debug-verbose   # Shows output in terminal AND logs to file",
  );
  console.error("  yarn cli test dms --no-fail        # Uses retry mode");
  console.error("  yarn cli test dms --debug        # Uses retry mode");
  console.error(
    "  yarn cli test dms --versions 3 # Uses random workers with versions 2.0.9, 2.1.0, and 2.2.0",
  );
  console.error(
    "  yarn cli test dms --nodeVersion 3.1.1 # Uses workers with SDK version 3.1.1",
  );
  console.error(
    "  yarn cli test dms --env production # Sets XMTP_ENV to production",
  );
  console.error(
    "  yarn cli test dms --no-clean-logs  # Disable automatic log cleaning",
  );
  console.error(
    "  yarn cli test dms --log-level error  # Set logging level to error",
  );
  process.exit(1);
}

/**
 * Runs an interactive bot with watch mode
 * Bots are located in bots/<bot_name>/index.ts
 */
function runBot(botName: string, args: string[]): void {
  const botFilePath = path.join("bots", botName, "index.ts");
  const botArgs = args.join(" ");
  console.debug(
    `Starting bot: ${botName}${botArgs ? ` with args: ${botArgs}` : ""}`,
  );
  execSync(`tsx --watch ${botFilePath} ${botArgs}`, {
    stdio: "inherit",
  });
}

/**
 * Executes a utility script once
 * Scripts are located in scripts/<script_name>.ts
 */
function runScript(scriptName: string, args: string[]): void {
  const scriptFilePath = path.join("scripts", `${scriptName}.ts`);
  const scriptArgs = args.join(" ");
  console.debug(
    `Running script: ${scriptName}${scriptArgs ? ` with args: ${scriptArgs}` : ""}`,
  );
  execSync(`tsx ${scriptFilePath} ${scriptArgs}`, {
    stdio: "inherit",
  });
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
    maxAttempts: 1,
    retryDelay: 10,
    enableLogging: true,
    vitestArgs: [],
    noFail: false,
    explicitLogFlag: false,
    verboseLogging: true, // Show terminal output by default
    parallel: false,
    cleanLogs: true,
    logLevel: "debug", // Default log level
    jsLoggingLevel: "silly",
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
      case "--max-attempts":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            options.maxAttempts = val;
          } else {
            console.warn(`Invalid value for --max-attempts: ${nextArg}`);
          }
          i++;
        }
        break;
      case "--retry-delay":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val >= 0) {
            options.retryDelay = val;
          } else {
            console.warn(`Invalid value for --retry-delay: ${nextArg}`);
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
      case "--debug":
        options.enableLogging = true;
        options.explicitLogFlag = true;
        options.verboseLogging = false;
        options.jsLoggingLevel = "silly";
        break;
      case "--debug-verbose":
        options.enableLogging = true;
        options.explicitLogFlag = true;
        options.verboseLogging = true;
        options.jsLoggingLevel = "silly";
        break;
      case "--no-log":
        options.enableLogging = false;
        options.explicitLogFlag = false;
        break;
      case "--debug-file":
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
            "--log-level flag requires a value (e.g., --log-level debug)",
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

async function runCommand(
  command: string,
  env: Record<string, string>,
  logger: ReturnType<typeof createTestLogger>,
): Promise<{ exitCode: number; errorOutput: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let errorOutput = "";

    child.stdout?.on("data", (data: Buffer) => {
      logger.processOutput(data);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const errorText = data.toString();
      errorOutput += errorText;
      logger.processOutput(data);
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

async function runVitestTest(
  testName: string,
  options: RetryOptions,
): Promise<void> {
  const logger = createTestLogger({
    enableLogging: options.enableLogging,
    customLogFile: options.customLogFile,
    testName,
    verboseLogging: options.verboseLogging,
    logLevel: options.logLevel, // Pass the logLevel option
  });

  console.debug(
    `Starting test suite: "${testName}" with up to ${options.maxAttempts} attempts, delay ${options.retryDelay}s.`,
  );

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
    console.debug(`Setting TEST_VERSIONS environment variable to: ${versions}`);

    // Remove from vitestArgs since it's not a vitest parameter
    options.vitestArgs = options.vitestArgs.filter(
      (arg) => !arg.startsWith("--versions="),
    );
  }

  // Extract --nodeVersion parameter and set as environment variable
  const nodeVersionArg = options.vitestArgs.find((arg) =>
    arg.startsWith("--nodeVersion="),
  );
  if (nodeVersionArg) {
    const nodeVersion = nodeVersionArg.split("=")[1];
    env.NODE_VERSION = nodeVersion;
    console.debug(
      `Setting NODE_VERSION environment variable to: ${nodeVersion}`,
    );

    // Remove from vitestArgs since it's not a vitest parameter
    options.vitestArgs = options.vitestArgs.filter(
      (arg) => !arg.startsWith("--nodeVersion="),
    );
  }

  // Extract --env parameter and set as environment variable
  const envArg = options.vitestArgs.find((arg) => arg.startsWith("--env="));
  if (envArg) {
    const envValue = envArg.split("=")[1];
    env.XMTP_ENV = envValue;
    console.debug(`Setting XMTP_ENV environment variable to: ${envValue}`);

    // Remove from vitestArgs since it's not a vitest parameter
    options.vitestArgs = options.vitestArgs.filter(
      (arg) => !arg.startsWith("--env="),
    );
  }

  // Extract --sync parameter and set as environment variable
  const syncArg = options.vitestArgs.find((arg) => arg.startsWith("--sync="));
  if (syncArg) {
    const syncValue = syncArg.split("=")[1];
    env.SYNC_STRATEGY = syncValue;
    console.debug(
      `Setting SYNC_STRATEGY environment variable to: ${syncValue}`,
    );

    // Remove from vitestArgs since it's not a vitest parameter
    options.vitestArgs = options.vitestArgs.filter(
      (arg) => !arg.startsWith("--sync="),
    );
  }

  // Set logging level
  env.LOGGING_LEVEL = options.logLevel || "error";

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    console.debug(`Attempt ${attempt} of ${options.maxAttempts}...`);

    try {
      const command = buildTestCommand(
        testName,
        options.vitestArgs,
        options.parallel,
      );
      console.debug(`Executing: ${command}`);

      const { exitCode } = await runCommand(command, env, logger);

      if (exitCode === 0) {
        console.debug("Tests passed successfully!");
        logger.close();

        // Clean the log file if enabled
        if (options.cleanLogs) {
          await cleanSpecificLogFile(logger.logFileName);
        }

        return;
      } else {
        console.debug("Tests failed!");
      }

      if (attempt === options.maxAttempts) {
        console.error(
          `\n❌ Test suite "${testName}" failed after ${options.maxAttempts} attempts.`,
        );

        if (options.explicitLogFlag)
          await sendDatadogLog(logger.logFileName, testName);

        logger.close();

        // Clean the log file if enabled (even for failed tests)
        if (options.cleanLogs) {
          await cleanSpecificLogFile(logger.logFileName);
        }

        if (options.noFail) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      }

      if (options.retryDelay > 0) {
        console.debug(`\n⏳ Retrying in ${options.retryDelay} seconds...`);
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          options.retryDelay * 1000,
        );
      } else {
        console.debug("\n🔄 Retrying immediately...");
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`);
      console.error(error);
    }
  }
}

async function main(): Promise<void> {
  const [commandType, nameOrPath, ...additionalArgs] = process.argv.slice(2);

  if (!commandType) {
    showUsageAndExit();
  }

  try {
    switch (commandType) {
      case "bot": {
        if (!nameOrPath) {
          console.error("bot name is required for 'bot' command type.");
          showUsageAndExit();
        }
        runBot(nameOrPath, additionalArgs);
        break;
      }

      case "script": {
        if (!nameOrPath) {
          console.error("Script name is required for 'script' command type.");
          showUsageAndExit();
        }
        runScript(nameOrPath, additionalArgs);
        break;
      }

      case "test": {
        const allArgs = nameOrPath
          ? [nameOrPath, ...additionalArgs]
          : additionalArgs;

        const { testName, options } = parseTestArgs(allArgs);

        // Check if this is a simple test run (no retry options)
        const isSimpleRun =
          options.maxAttempts === 1 &&
          !options.explicitLogFlag &&
          !options.noFail;

        if (isSimpleRun) {
          // Process environment variables for simple runs too
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
            console.debug(
              `Setting TEST_VERSIONS environment variable to: ${versions}`,
            );

            // Remove from vitestArgs since it's not a vitest parameter
            options.vitestArgs = options.vitestArgs.filter(
              (arg) => !arg.startsWith("--versions="),
            );
          }

          // Extract --nodeVersion parameter and set as environment variable
          const nodeVersionArg = options.vitestArgs.find((arg) =>
            arg.startsWith("--nodeVersion="),
          );
          if (nodeVersionArg) {
            const nodeVersion = nodeVersionArg.split("=")[1];
            env.NODE_VERSION = nodeVersion;
            console.debug(
              `Setting NODE_VERSION environment variable to: ${nodeVersion}`,
            );

            // Remove from vitestArgs since it's not a vitest parameter
            options.vitestArgs = options.vitestArgs.filter(
              (arg) => !arg.startsWith("--nodeVersion="),
            );
          }

          // Extract --env parameter and set as environment variable
          const envArg = options.vitestArgs.find((arg) =>
            arg.startsWith("--env="),
          );
          if (envArg) {
            const envValue = envArg.split("=")[1];
            env.XMTP_ENV = envValue;
            console.debug(
              `Setting XMTP_ENV environment variable to: ${envValue}`,
            );

            // Remove from vitestArgs since it's not a vitest parameter
            options.vitestArgs = options.vitestArgs.filter(
              (arg) => !arg.startsWith("--env="),
            );
          }

          // Extract --sync parameter and set as environment variable
          const syncArg = options.vitestArgs.find((arg) =>
            arg.startsWith("--sync="),
          );
          if (syncArg) {
            const syncValue = syncArg.split("=")[1];
            env.SYNC_STRATEGY = syncValue;
            console.debug(
              `Setting SYNC_STRATEGY environment variable to: ${syncValue}`,
            );

            // Remove from vitestArgs since it's not a vitest parameter
            options.vitestArgs = options.vitestArgs.filter(
              (arg) => !arg.startsWith("--sync="),
            );
          }

          // Run test directly without logger for native terminal output
          const command = buildTestCommand(
            testName,
            options.vitestArgs,
            options.parallel,
          );
          console.debug(`Running test: ${testName}`);
          console.debug(`Executing: ${command}`);
          execSync(command, { stdio: "inherit", env });
        } else {
          // Use retry mechanism with logger
          await runVitestTest(testName, options);
        }

        break;
      }

      default: {
        console.error(`Unknown command type: ${commandType}`);
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
