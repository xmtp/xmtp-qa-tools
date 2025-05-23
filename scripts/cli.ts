import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createTestLogger, type TestLogOptions } from "@helpers/logger";

interface RetryOptions {
  maxAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  customLogFile?: string;
  vitestArgs: string[];
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
    "  retry [suite_name_or_path] [options...] - Runs tests (e.g., functional)",
  );
  console.error("    Test options:");
  console.error(
    "      --max-attempts <N>  Max number of attempts for tests (default: 3)",
  );
  console.error(
    "      --retry-delay <S>   Delay in seconds between retries (default: 10)",
  );
  console.error(
    "      --log / --no-log    Enable/disable logging to file (default: enabled)",
  );
  console.error(
    "      --log-file <name>   Custom log file name (default: auto-generated)",
  );
  console.error(
    "      [vitest_options...] Other options passed directly to vitest",
  );
  console.error("");
  console.error("Examples:");
  console.error("  yarn cli bot gm-bot");
  console.error("  yarn cli bot stress 5");
  console.error("  yarn cli script gen");
  console.error("  yarn retry functional --max-attempts 2");
  console.error("  yarn retry ./suites/automated/Gm/gm.test.ts --watch");
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

function parseRetryArgs(args: string[]): {
  testName: string;
  options: RetryOptions;
} {
  let testName = "functional";
  const options: RetryOptions = {
    maxAttempts: 1,
    retryDelay: 10,
    enableLogging: true,
    vitestArgs: [],
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
      case "--log":
        options.enableLogging = true;
        break;
      case "--no-log":
        options.enableLogging = false;
        break;
      case "--log-file":
        if (nextArg) {
          options.customLogFile = nextArg;
          i++;
        }
        break;
      default:
        options.vitestArgs.push(arg);
    }
  }

  return { testName, options };
}

function buildTestCommand(testName: string, vitestArgs: string[]): string {
  const vitestArgsString = vitestArgs.join(" ");

  if (testName === "functional") {
    const expandedFiles = expandGlobPattern("./functional/*.test.ts");
    if (expandedFiles.length === 0) {
      throw new Error("No functional test files found");
    }
    return `npx vitest run ${expandedFiles.join(" ")} --pool=threads --poolOptions.singleThread=true --fileParallelism=false ${vitestArgsString}`;
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
          return `${script.replace(globMatch[1], expandedFiles.join(" "))} ${vitestArgsString}`;
        }
      }
      return `yarn ${testName} ${vitestArgsString}`;
    }
  } catch (error: unknown) {
    console.error("Error reading package.json:", error);
  }

  return `npx vitest run ${testName} --pool=forks --fileParallelism=false ${vitestArgsString}`;
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
  });

  console.log(
    `Starting test suite: "${testName}" with up to ${options.maxAttempts} attempts, delay ${options.retryDelay}s.`,
  );

  const env = {
    ...process.env,
    RUST_BACKTRACE: "1",
    LOGGING_LEVEL: "debug",
  };

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    console.log(`Attempt ${attempt} of ${options.maxAttempts}...`);

    try {
      const command = buildTestCommand(testName, options.vitestArgs);
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

        // Provide helpful debugging info
        console.error("\n🔍 Debugging tips:");
        console.error("  • Check the full logs for detailed error information");
        console.error("  • Verify your environment variables (.env file)");
        console.error("  • Ensure all required services are running");
        console.error(
          `  • Try running manually: ${buildTestCommand(testName, options.vitestArgs)}`,
        );

        logger.close();
        process.exit(1);
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
          console.error("Error: Bot name is required for 'bot' command type.");
          showUsageAndExit();
        }
        runBot(nameOrPath, additionalArgs);
        break;
      }

      case "script": {
        if (!nameOrPath) {
          console.error(
            "Error: Script name is required for 'script' command type.",
          );
          showUsageAndExit();
        }
        runScript(nameOrPath, additionalArgs);
        break;
      }

      case "retry": {
        const allArgs = nameOrPath
          ? [nameOrPath, ...additionalArgs]
          : additionalArgs;
        const { testName, options } = parseRetryArgs(allArgs);
        await runRetryTests(testName, options);
        break;
      }

      default: {
        console.error(`Error: Unknown command type "${commandType}"`);
        showUsageAndExit();
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to run command: ${message}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
