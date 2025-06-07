import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createTestLogger, extractErrorLogs } from "@helpers/logger";
import { sendSlackNotification } from "@helpers/slack";
import "dotenv/config";

interface RetryOptions {
  maxAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  customLogFile?: string;
  vitestArgs: string[];
  noFail: boolean;
  explicitLogFlag: boolean;
  verboseLogging: boolean;
  parallel: boolean;
}

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
  console.error(
    "      yarn cli test functional         - Runs vitest directly",
  );
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
    "      --debug-file <name>   Custom log file name (default: auto-generated)",
  );
  console.error(
    "      --no-fail           Exit with code 0 even on test failures (still sends Slack notifications)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli bot stress 5");
  console.error("  yarn cli script gen");
  console.error("  yarn cli test functional");
  console.error(
    "  yarn cli test functional --max-attempts 2  # Uses retry mode",
  );
  console.error(
    "  yarn cli test functional --parallel       # Runs tests in parallel",
  );
  console.error(
    "  yarn cli test functional --debug-verbose   # Shows output in terminal AND logs to file",
  );
  console.error(
    "  yarn cli test functional --no-fail        # Uses retry mode",
  );
  process.exit(1);
}

function runBot(botName: string, args: string[]): void {
  const botFilePath = path.join("bots", botName, "index.ts");
  const botArgs = args.join(" ");
  console.log(
    `Starting bot: ${botName}${botArgs ? ` with args: ${botArgs}` : ""}`,
  );
  execSync(`tsx --watch ${botFilePath} ${botArgs}`, {
    stdio: "inherit",
  });
}

function runScript(scriptName: string, args: string[]): void {
  const scriptFilePath = path.join("scripts", `${scriptName}.ts`);
  const scriptArgs = args.join(" ");
  console.log(
    `Running script: ${scriptName}${scriptArgs ? ` with args: ${scriptArgs}` : ""}`,
  );
  execSync(`tsx ${scriptFilePath} ${scriptArgs}`, {
    stdio: "inherit",
  });
}

function hasRetryOptions(args: string[]): boolean {
  const retrySpecificOptions = [
    "--max-attempts",
    "--retry-delay",
    "--debug",
    "--no-log",
    "--debug-file",
    "--no-fail",
    "--debug-verbose",
  ];

  return args.some((arg) => retrySpecificOptions.includes(arg));
}

function runSimpleVitest(testName: string, args: string[]): void {
  // Check if --parallel flag is present
  const parallelIndex = args.indexOf("--parallel");
  const isParallel = parallelIndex !== -1;

  // Remove --parallel from args since it's not a vitest option
  const filteredArgs = isParallel
    ? args.filter((_, index) => index !== parallelIndex)
    : args;

  const command = buildTestCommand(testName, filteredArgs, isParallel);
  console.log(`Running vitest: ${command}`);

  // Check if --debug was explicitly passed
  const explicitLogFlag = args.includes("--debug");

  const env: Record<string, string> = {
    ...process.env,
    RUST_BACKTRACE: "1",
  };

  // Only set debug logging if --debug was explicitly passed
  if (explicitLogFlag) {
    env.LOGGING_LEVEL = "debug";
  }

  execSync(command, {
    stdio: "inherit",
    env,
  });
}

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
    verboseLogging: false,
    parallel: false,
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
      case "--debug":
        options.enableLogging = true;
        options.explicitLogFlag = true;
        break;
      case "--debug-verbose":
        options.enableLogging = true;
        options.explicitLogFlag = true;
        options.verboseLogging = true;
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
    const expandedFiles = expandGlobPattern("./functional/*.test.ts");
    if (expandedFiles.length === 0) {
      throw new Error("No functional test files found");
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

async function runRetryTests(
  testName: string,
  options: RetryOptions,
): Promise<void> {
  const logger = createTestLogger({
    enableLogging: options.enableLogging,
    customLogFile: options.customLogFile,
    testName,
    verboseLogging: options.verboseLogging,
  });

  console.log(
    `Starting test suite: "${testName}" with up to ${options.maxAttempts} attempts, delay ${options.retryDelay}s.`,
  );

  const env: Record<string, string> = {
    ...process.env,
    RUST_BACKTRACE: "1",
  };

  // Only set debug logging if --debug was explicitly passed
  if (options.explicitLogFlag) {
    env.LOGGING_LEVEL = "debug";
  }

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    console.log(`Attempt ${attempt} of ${options.maxAttempts}...`);

    try {
      const command = buildTestCommand(
        testName,
        options.vitestArgs,
        options.parallel,
      );
      console.log(`Executing: ${command}`);

      const { exitCode, errorOutput } = await runCommand(command, env, logger);

      if (exitCode === 0) {
        console.log("Tests passed successfully!");
        logger.close();
        process.exit(0);
      } else {
        // Extract meaningful error information
        const errorLines = errorOutput
          .split("\n")
          .filter((line) => line.trim())
          .slice(-10); // Get last 10 non-empty lines

        const errorMessage =
          errorLines.length > 0
            ? `Command failed with exit code ${exitCode}:\n${errorLines.join("\n")}`
            : `Command exited with code ${exitCode}`;

        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(`Attempt ${attempt} failed:`);
      console.error(errorMessage);

      // Log additional context if available
      if (options.enableLogging) {
        console.error(`\nFull logs are being written to the log file`);
      }

      if (attempt === options.maxAttempts) {
        console.error(
          `\n❌ Test suite "${testName}" failed after ${options.maxAttempts} attempts.`,
        );

        // Extract and send Slack notification with error logs
        const errorLogs = extractErrorLogs(logger.logFileName);
        await sendSlackNotification({
          testName,
          errorLogs,
        });

        logger.close();
        if (options.noFail) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      }

      if (options.retryDelay > 0) {
        console.log(`\n⏳ Retrying in ${options.retryDelay} seconds...`);
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          options.retryDelay * 1000,
        );
      } else {
        console.log("\n🔄 Retrying immediately...");
      }
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

        // Check if retry-specific options are present
        if (hasRetryOptions(allArgs)) {
          // Use retry logic with multiple attempts, logging, etc.
          const { testName, options } = parseTestArgs(allArgs);
          await runRetryTests(testName, options);
        } else {
          // Run vitest directly for simple test execution
          const testName = nameOrPath || "functional";
          runSimpleVitest(testName, additionalArgs);
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
