/**
 * XMTP QA Tools CLI
 *
 * Universal command router for running tests, bots, and scripts.
 * Provides advanced retry mechanisms, logging, and version management.
 *
 * Usage: yarn cli <command_type> <n> [options]
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

// ============================================================================
// CONFIGURATION TYPES AND INTERFACES
// ============================================================================

/**
 * Configuration for test retry behavior and logging
 */
interface RetryOptions {
  maxAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  customLogFile?: string;
  vitestArgs: string[];
  noFail: boolean;
  explicitLogFlag: boolean;
  verboseLogging: boolean;
  jsLoggingLevel: string;
  parallel: boolean;
  cleanLogs: boolean;
  logLevel: string;
  noErrorLogs: boolean;
}

/**
 * Environment configuration for test execution
 */
interface TestEnvironment {
  RUST_BACKTRACE: string;
  TEST_VERSIONS?: string;
  NODE_VERSION?: string;
  XMTP_ENV?: string;
  SYNC_STRATEGY?: string;
  LOGGING_LEVEL?: string;
}

/**
 * Parsed command structure
 */
interface ParsedCommand {
  type: 'bot' | 'script' | 'stress' | 'test';
  name: string;
  args: string[];
}

/**
 * Test command configuration
 */
interface TestConfig {
  testName: string;
  options: RetryOptions;
  environment: TestEnvironment;
}

// ============================================================================
// PARAMETER DEFINITIONS AND DEFAULTS
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  retry: {
    maxAttempts: 1,
    retryDelay: 10,
    enableLogging: true,
    vitestArgs: [],
    noFail: false,
    explicitLogFlag: false,
    verboseLogging: true,
    parallel: false,
    cleanLogs: true,
    logLevel: "debug",
    jsLoggingLevel: "silly",
    noErrorLogs: false,
  } as RetryOptions,
  
  environment: {
    RUST_BACKTRACE: "1",
  } as TestEnvironment,
  
  test: {
    defaultSuite: "functional",
  },
} as const;

/**
 * Flag definitions with their parameter requirements
 */
const FLAG_DEFINITIONS = {
  // Retry configuration
  '--max-attempts': { takesValue: true, type: 'number', min: 1 },
  '--retry-delay': { takesValue: true, type: 'number', min: 0 },
  '--parallel': { takesValue: false, type: 'boolean' },
  '--no-fail': { takesValue: false, type: 'boolean' },
  
  // Logging configuration
  '--debug': { takesValue: false, type: 'boolean' },
  '--debug-verbose': { takesValue: false, type: 'boolean' },
  '--no-log': { takesValue: false, type: 'boolean' },
  '--debug-file': { takesValue: true, type: 'string' },
  '--verbose-logging': { takesValue: false, type: 'boolean' },
  '--no-clean-logs': { takesValue: false, type: 'boolean' },
  '--log-level': { takesValue: true, type: 'string', values: ['debug', 'info', 'error'] },
  '--no-error-logs': { takesValue: false, type: 'boolean' },
  
  // Environment configuration
  '--env': { takesValue: true, type: 'string', values: ['local', 'dev', 'production'] },
  '--versions': { takesValue: true, type: 'string' },
  '--nodeVersion': { takesValue: true, type: 'string' },
  '--sync': { takesValue: true, type: 'string' },
} as const;

// ============================================================================
// ARGUMENT PARSING UTILITIES
// ============================================================================

/**
 * Validates a flag value against its definition
 */
function validateFlagValue(flag: string, value: string): boolean {
  const def = FLAG_DEFINITIONS[flag as keyof typeof FLAG_DEFINITIONS];
  if (!def) return true;
  
  if (def.type === 'number') {
    const num = parseInt(value, 10);
    if (isNaN(num)) return false;
    if (def.min !== undefined && num < def.min) return false;
    return true;
  }
  
  if (def.values && !def.values.includes(value)) {
    return false;
  }
  
  return true;
}

/**
 * Parses command line arguments into structured configuration
 */
function parseArguments(args: string[]): ParsedCommand {
  const [commandType, nameOrPath, ...additionalArgs] = args;
  
  if (!commandType) {
    throw new Error('Command type is required');
  }
  
  const validCommands = ['bot', 'script', 'stress', 'test'] as const;
  if (!validCommands.includes(commandType as any)) {
    throw new Error(`Invalid command type: ${commandType}`);
  }
  
  return {
    type: commandType as any,
    name: nameOrPath || '',
    args: additionalArgs,
  };
}

/**
 * Parses test-specific arguments and builds configuration
 */
function parseTestConfiguration(args: string[]): TestConfig {
  let testName = DEFAULT_CONFIG.test.defaultSuite;
  const options = { ...DEFAULT_CONFIG.retry };
  const environment = { ...DEFAULT_CONFIG.environment };
  
  // Extract test name if first arg is not a flag
  let currentArgs = [...args];
  if (currentArgs.length > 0 && !currentArgs[0].startsWith('--')) {
    const shiftedArg = currentArgs.shift();
    testName = shiftedArg || DEFAULT_CONFIG.test.defaultSuite;
  }
  
  // Parse flags
  for (let i = 0; i < currentArgs.length; i++) {
    const arg = currentArgs[i];
    const nextArg = currentArgs[i + 1];
    
    const flagDef = FLAG_DEFINITIONS[arg as keyof typeof FLAG_DEFINITIONS];
    
    if (flagDef) {
      if (flagDef.takesValue) {
        if (!nextArg || nextArg.startsWith('--')) {
          console.warn(`Flag ${arg} requires a value`);
          continue;
        }
        
        if (!validateFlagValue(arg, nextArg)) {
          console.warn(`Invalid value for ${arg}: ${nextArg}`);
          continue;
        }
        
        applyFlagWithValue(arg, nextArg, options, environment);
        i++; // Skip next arg since it was consumed
      } else {
        applyBooleanFlag(arg, options);
      }
    } else {
      // Pass unknown args to vitest
      options.vitestArgs.push(arg);
    }
  }
  
  return { testName, options, environment };
}

/**
 * Applies a flag with a value to the configuration
 */
function applyFlagWithValue(
  flag: string, 
  value: string, 
  options: RetryOptions, 
  environment: TestEnvironment
): void {
  switch (flag) {
    case '--max-attempts':
      options.maxAttempts = parseInt(value, 10);
      break;
    case '--retry-delay':
      options.retryDelay = parseInt(value, 10);
      break;
    case '--debug-file':
      options.customLogFile = value;
      break;
    case '--log-level':
      options.logLevel = value;
      break;
    case '--env':
      environment.XMTP_ENV = value;
      break;
    case '--versions':
      environment.TEST_VERSIONS = value;
      break;
    case '--nodeVersion':
      environment.NODE_VERSION = value;
      break;
    case '--sync':
      environment.SYNC_STRATEGY = value;
      break;
  }
}

/**
 * Applies a boolean flag to the configuration
 */
function applyBooleanFlag(flag: string, options: RetryOptions): void {
  switch (flag) {
    case '--parallel':
      options.parallel = true;
      break;
    case '--no-fail':
      options.noFail = true;
      break;
    case '--debug':
      options.enableLogging = true;
      options.explicitLogFlag = true;
      options.verboseLogging = false;
      options.jsLoggingLevel = "silly";
      break;
    case '--debug-verbose':
      options.enableLogging = true;
      options.explicitLogFlag = true;
      options.verboseLogging = true;
      options.jsLoggingLevel = "silly";
      break;
    case '--no-log':
      options.enableLogging = false;
      options.explicitLogFlag = false;
      break;
    case '--verbose-logging':
      options.verboseLogging = true;
      break;
    case '--no-clean-logs':
      options.cleanLogs = false;
      break;
    case '--no-error-logs':
      options.noErrorLogs = true;
      break;
  }
}

// ============================================================================
// COMMAND EXECUTION HANDLERS
// ============================================================================

/**
 * Runs an interactive bot with watch mode
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

// ============================================================================
// TEST EXECUTION LOGIC
// ============================================================================

/**
 * Expands glob patterns to actual file paths
 */
function expandGlobPattern(pattern: string): string[] {
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

/**
 * Builds the test command string
 */
function buildTestCommand(
  testName: string,
  vitestArgs: string[],
  parallel: boolean = false,
): string {
  const vitestArgsString = vitestArgs.join(" ");
  const threadingOptions = parallel
    ? ""
    : "--pool=threads --poolOptions.singleThread=true --fileParallelism=false";

  if (testName === "functional") {
    const expandedFiles = expandGlobPattern("./suites/functional/*.test.ts");
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
 * Runs a command with logging and environment setup
 */
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

/**
 * Cleans log files after test completion
 */
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

  if (!fs.existsSync(rawFilePath)) {
    console.debug(`Raw log file not found: ${rawFilePath}`);
    return;
  }

  if (pattern) {
    const outputDir = path.join(logsDir, "cleaned");
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }
    const outputFileName = `cleaned-${logFileName}`;
    outputPath = path.join(outputDir, outputFileName);

    try {
      const { processLogFile } = await import("@helpers/logger");
      await processLogFile(rawFilePath, outputPath);
      console.debug(`Cleaned log file: ${logFileName} -> ${outputPath}`);
    } catch (error) {
      console.error(`Failed to clean log file ${logFileName}:`, error);
    }
  } else {
    try {
      const content = await fs.promises.readFile(rawFilePath, "utf8");
      const { stripAnsi } = await import("@helpers/logger");
      const cleanedContent = stripAnsi(content);
      await fs.promises.writeFile(rawFilePath, cleanedContent);
      console.debug(logFileName);
    } catch (error) {
      console.error(`Failed to clean ANSI codes from ${logFileName}:`, error);
    }
  }
}

/**
 * Executes tests with retry logic
 */
async function runVitestTest(config: TestConfig): Promise<void> {
  const { testName, options, environment } = config;
  
  const logger = createTestLogger({
    enableLogging: options.enableLogging,
    customLogFile: options.customLogFile,
    testName,
    verboseLogging: options.verboseLogging,
    logLevel: options.logLevel,
  });

  console.debug(
    `Starting test suite: "${testName}" with up to ${options.maxAttempts} attempts, delay ${options.retryDelay}s.`,
  );

  const env: Record<string, string> = {
    ...process.env,
    ...environment,
    LOGGING_LEVEL: options.logLevel || "error",
  };

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

        if (options.explicitLogFlag && !options.noErrorLogs) {
          await sendDatadogLog(logger.logFileName, testName);
        }

        logger.close();

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

/**
 * Executes a simple test without retry logic
 */
function runSimpleTest(config: TestConfig): void {
  const { testName, options, environment } = config;
  
  const env: Record<string, string> = {
    ...process.env,
    ...environment,
  };

  const command = buildTestCommand(
    testName,
    options.vitestArgs,
    options.parallel,
  );
  
  console.debug(`Running test: ${testName}`);
  console.debug(`Executing: ${command}`);
  
  try {
    execSync(command, { stdio: "inherit", env });
  } catch (error) {
    if (options.noFail) {
      console.debug(
        "Test failed but --no-fail was specified, exiting with code 0",
      );
      process.exit(0);
    } else {
      throw error;
    }
  }
}

// ============================================================================
// USAGE AND HELP
// ============================================================================

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
    "  stress [options...]                 - Runs stress testing (e.g., --users 400 --msgs 1)",
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
    "      --no-error-logs     Disable sending error logs to Datadog (default: enabled)",
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
  console.error("  yarn cli stress --users 400 --msgs 1");
  console.error("  yarn cli stress --users 200 --msgs 2 --env production");
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

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  try {
    const command = parseArguments(process.argv.slice(2));

    switch (command.type) {
      case 'bot': {
        if (!command.name) {
          console.error("Bot name is required for 'bot' command type.");
          showUsageAndExit();
        }
        runBot(command.name, command.args);
        break;
      }

      case 'script': {
        if (!command.name) {
          console.error("Script name is required for 'script' command type.");
          showUsageAndExit();
        }
        runScript(command.name, command.args);
        break;
      }

      case 'stress': {
        const allArgs = command.name ? [command.name, ...command.args] : command.args;
        console.debug("Running stress test with args:", allArgs);
        runScript("stress", allArgs);
        break;
      }

      case 'test': {
        const allArgs = command.name ? [command.name, ...command.args] : command.args;
        const config = parseTestConfiguration(allArgs);

        // Determine if this is a simple test run or requires retry logic
        const isSimpleRun = config.options.maxAttempts === 1 && !config.options.explicitLogFlag;

        if (isSimpleRun) {
          runSimpleTest(config);
        } else {
          await runVitestTest(config);
        }
        break;
      }

      default: {
        console.error(`Unknown command type: ${command.type}`);
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
