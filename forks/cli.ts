import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { cleanAllRawLogs, cleanForksLogs } from "@helpers/analyzer";
import "dotenv/config";
import {
  chaosPresets,
  epochRotationOperations,
  groupCount,
  installationCount,
  network,
  NODE_VERSION,
  otherOperations,
  parallelOperations,
  randomInboxIdsCount,
  targetEpoch,
  testName,
  workerNames,
  type ChaosLevel,
} from "./config";

interface ForkOptions {
  count: number; // Number of times to run the process (default: 100)
  cleanAll: boolean; // Clean all raw logs before starting
  removeNonMatching: boolean; // Remove non-matching logs
  env?: string; // XMTP environment (local, dev, production)
  chaosEnabled: boolean; // Enable network chaos
  chaosLevel: ChaosLevel; // Chaos level (low, medium, high)
}

function showHelp() {
  console.log(`
XMTP Fork Detection CLI - Fork detection and analysis

USAGE:
  yarn fork [options]

OPTIONS:
  --count <number>           Number of times to run the fork detection process [default: 100]
  --clean-all                Clean all raw logs before starting (equivalent to ansi:clean)
  --remove-non-matching      Remove logs that don't contain fork content [default: true]
  --no-remove-non-matching   Keep logs that don't contain fork content
  --env <environment>        XMTP environment (local, dev, production) [default: dev]
  --chaos-enabled            Enable network chaos testing (requires --env local)
  --chaos-level <level>      Chaos level: low, medium, high [default: medium]
  -h, --help                 Show this help message

CHAOS LEVELS:
  low      - Delay: 50-150ms, Jitter: 0-50ms, Loss: 0-2%, Interval: 15s
  medium   - Delay: 100-300ms, Jitter: 0-75ms, Loss: 0-3.5%, Interval: 10s
  high     - Delay: 100-500ms, Jitter: 0-100ms, Loss: 0-5%, Interval: 10s

EXAMPLES:
  yarn fork                              # Run 100 times and get stats
  yarn fork --count 50                   # Run 50 times
  yarn fork --clean-all                  # Clean all raw logs before starting
  yarn fork --count 200 --env local      # Run 200 times on local environment
  yarn fork --env local --chaos-enabled  # Run with medium network chaos
  yarn fork --env local --chaos-enabled --chaos-level high  # Run with high chaos

For more information, see: forks/README.md
`);
}

/**
 * Get fork count from cleaned logs directory
 */
function getForkCount(): number {
  const logsDir = path.join(process.cwd(), "logs", "cleaned");
  if (!fs.existsSync(logsDir)) {
    return 0;
  }
  return fs.readdirSync(logsDir).length;
}

/**
 * Run the fork test (suppress output)
 */
function runForkTest(options: ForkOptions): void {
  const envFlag = options.env ? `--env ${options.env}` : "";
  const command = `yarn test forks ${envFlag} --log warn --file`.trim();

  try {
    execSync(command, {
      stdio: "ignore",
      env: {
        ...process.env,
        CHAOS_ENABLED: options.chaosEnabled ? "true" : "false",
        CHAOS_LEVEL: options.chaosLevel,
      },
    });
  } catch {
    console.log("Error running fork test");
    // Test may fail if forks are detected, that's expected
    // We'll analyze the logs afterward
  }
}

/**
 * Log fork matrix parameters from shared config
 */
function logForkMatrixParameters(options: ForkOptions): void {
  console.info("\nFORK MATRIX PARAMETERS");
  console.info("-".repeat(60));
  console.info(`groupCount: ${groupCount}`);
  console.info(`parallelOperations: ${parallelOperations}`);
  console.info(`NODE_VERSION: ${NODE_VERSION}`);
  console.info(`workerNames: [${workerNames.join(", ")}]`);
  console.info(
    `epochRotationOperations: ${JSON.stringify(epochRotationOperations)}`,
  );
  console.info(`otherOperations: ${JSON.stringify(otherOperations)}`);
  console.info(`targetEpoch: ${targetEpoch}`);
  console.info(`network: ${network || "undefined"}`);
  console.info(`randomInboxIdsCount: ${randomInboxIdsCount}`);
  console.info(`installationCount: ${installationCount}`);
  console.info(`testName: ${testName}`);

  if (options.chaosEnabled) {
    const preset = chaosPresets[options.chaosLevel];
    console.info("\nNETWORK CHAOS PARAMETERS");
    console.info(`chaosEnabled: true`);
    console.info(`chaosLevel: ${options.chaosLevel}`);
    console.info(`  delay: ${preset.delayMin}-${preset.delayMax}ms`);
    console.info(`  jitter: ${preset.jitterMin}-${preset.jitterMax}ms`);
    console.info(`  packetLoss: ${preset.lossMin}-${preset.lossMax}%`);
    console.info(`  interval: ${preset.interval}ms`);
  }

  console.info("-".repeat(60) + "\n");
}

/**
 * Run fork detection process and collect stats
 */
async function runForkDetection(options: ForkOptions): Promise<void> {
  console.info("=".repeat(60));
  console.info("XMTP Fork Detection CLI");
  console.info("=".repeat(60));

  // Validate chaos requirements
  if (options.chaosEnabled && options.env !== "local") {
    console.error("\n❌ Error: Network chaos testing requires --env local");
    console.error(
      "Network chaos manipulates Docker containers which are only available in local environment.\n",
    );
    process.exit(1);
  }

  // Log fork matrix parameters once
  logForkMatrixParameters(options);

  console.info(`Running fork detection process ${options.count} time(s)...\n`);

  const stats = {
    totalRuns: 0,
    forksDetected: 0,
    runsWithForks: 0,
    runsWithoutForks: 0,
  };

  // Clean logs if requested before starting
  if (options.cleanAll) {
    console.info("Cleaning all raw logs before starting...");
    await cleanAllRawLogs();
    console.info("Finished cleaning all raw logs\n");
  }

  // Run the test N times
  for (let i = 1; i <= options.count; i++) {
    // Run the fork test (silently)
    runForkTest(options);

    // Clean and analyze fork logs after the test (suppress output)
    const originalConsoleDebug = console.debug;
    console.debug = () => {}; // Suppress debug output
    await cleanForksLogs(options.removeNonMatching);
    console.debug = originalConsoleDebug;

    // Count forks detected
    const forkCount = getForkCount();
    stats.totalRuns++;
    stats.forksDetected += forkCount;

    // Show only run number and result
    if (forkCount > 0) {
      stats.runsWithForks++;
      console.info(
        `Run ${i}/${options.count}: ✅ ${forkCount} fork(s) detected`,
      );
    } else {
      stats.runsWithoutForks++;
      console.info(`Run ${i}/${options.count}: ⚪ No forks`);
    }

    // Clean up empty cleaned directory if it exists
    const logsDir = path.join(process.cwd(), "logs", "cleaned");
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      if (files.length === 0) {
        fs.rmdirSync(logsDir);
      }
    }
  }

  // Display final statistics
  console.info("\n" + "=".repeat(60));
  console.info("FORK DETECTION STATISTICS");
  console.info("=".repeat(60));
  console.info(`Total runs: ${stats.totalRuns}`);
  console.info(`Total forks detected: ${stats.forksDetected}`);
  console.info(`Runs with forks: ${stats.runsWithForks}`);
  console.info(`Runs without forks: ${stats.runsWithoutForks}`);
  console.info(
    `Fork detection rate: ${(
      (stats.runsWithForks / stats.totalRuns) *
      100
    ).toFixed(2)}%`,
  );
  console.info(
    `Average forks per run: ${(stats.forksDetected / stats.totalRuns).toFixed(
      2,
    )}`,
  );
  if (stats.runsWithForks > 0) {
    console.info(
      `Average forks per run (with forks): ${(
        stats.forksDetected / stats.runsWithForks
      ).toFixed(2)}`,
    );
  }
  console.info("=".repeat(60));

  // Exit with error if forks were detected
  if (stats.forksDetected > 0) {
    console.error(`\n❌ Forks detected in ${stats.runsWithForks} run(s)!`);
    process.exit(1);
  } else {
    console.info(`\n✅ No forks detected across all runs!`);
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Default options
  const options: ForkOptions = {
    count: 100,
    cleanAll: false,
    removeNonMatching: true,
    env: process.env.XMTP_ENV || "dev",
    chaosEnabled: false,
    chaosLevel: "medium",
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        showHelp();
        process.exit(0);
        break;
      case "--count":
        if (i + 1 < args.length) {
          const count = parseInt(args[i + 1], 10);
          if (isNaN(count) || count < 1) {
            console.error("--count must be a positive number");
            process.exit(1);
          }
          options.count = count;
          i++; // Skip next argument
        } else {
          console.error("--count flag requires a value (e.g., --count 100)");
          process.exit(1);
        }
        break;
      case "--clean-all":
        options.cleanAll = true;
        break;
      case "--remove-non-matching":
        options.removeNonMatching = true;
        break;
      case "--no-remove-non-matching":
        options.removeNonMatching = false;
        break;
      case "--env":
        if (i + 1 < args.length) {
          const env = args[i + 1];
          if (!["local", "dev", "production"].includes(env)) {
            console.error("--env must be one of: local, dev, production");
            process.exit(1);
          }
          options.env = env;
          i++; // Skip next argument
        } else {
          console.error("--env flag requires a value (e.g., --env dev)");
          process.exit(1);
        }
        break;
      case "--chaos-enabled":
        options.chaosEnabled = true;
        break;
      case "--chaos-level":
        if (i + 1 < args.length) {
          const level = args[i + 1] as ChaosLevel;
          if (!["low", "medium", "high"].includes(level)) {
            console.error("--chaos-level must be one of: low, medium, high");
            process.exit(1);
          }
          options.chaosLevel = level;
          i++; // Skip next argument
        } else {
          console.error(
            "--chaos-level flag requires a value (e.g., --chaos-level medium)",
          );
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error("Use --help for usage information");
        process.exit(1);
    }
  }

  await runForkDetection(options);
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
