import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { cleanAllRawLogs, cleanForksLogs } from "@helpers/analyzer";
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  printConfig,
  resolveDbChaosConfig,
  resolveNetworkChaosConfig,
  type DbChaosLevel,
  type NetworkChaosLevel,
  type RuntimeConfig,
} from "./config";

// CLI options for fork testing
interface ForkOptions {
  count: number; // Number of times to run the process (default: 100)
  cleanAll: boolean; // Clean all raw logs before starting
  removeNonMatching: boolean; // Remove non-matching logs
  env?: string; // XMTP environment (local, dev, production)
  networkChaosLevel: NetworkChaosLevel; // Network chaos level
  dbChaosLevel: DbChaosLevel; // DB chaos level
  withBackgroundStreams: boolean; // Enable message streams on all workers
  logLevel: string; // Log level for test runner
  groupCount: number; // Number of groups to run the test against
  parallelOperations: number; // Number of parallel operations run on each group
  targetEpoch: number; // Target epoch to stop the test at
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
 * Build RuntimeConfig from ForkOptions
 */
function buildRuntimeConfig(options: ForkOptions): RuntimeConfig {
  return {
    groupCount: options.groupCount,
    parallelOperations: options.parallelOperations,
    targetEpoch: options.targetEpoch,
    network: (options.env || "dev") as "local" | "dev" | "production",
    networkChaos: resolveNetworkChaosConfig(options.networkChaosLevel),
    dbChaos: resolveDbChaosConfig(options.dbChaosLevel),
    backgroundStreams: options.withBackgroundStreams
      ? {
          cloned: true,
        }
      : null,
  };
}

/**
 * Run the fork test (suppress output) and return whether it completed successfully
 */
function runForkTest(
  options: ForkOptions,
  runtimeConfig: RuntimeConfig,
): boolean {
  const envFlag = options.env ? `--env ${options.env}` : "";
  const command =
    `yarn test forks ${envFlag} --log ${options.logLevel} --file`.trim();

  try {
    execSync(command, {
      stdio: "ignore",
      env: {
        ...process.env,
        FORK_TEST_CONFIG: JSON.stringify(runtimeConfig),
      },
    });

    return true;
  } catch (e: any) {
    console.error(`Error running fork test: ${e?.message}`);
    return false;
    // Test may fail if forks are detected, that's expected
    // We'll analyze the logs afterward
  }
}

/**
 * Run fork detection process and collect stats
 */
async function runForkDetection(options: ForkOptions): Promise<void> {
  console.info("=".repeat(60));
  console.info("XMTP Fork Detection CLI");
  console.info("=".repeat(60));

  // Validate chaos requirements
  if (options.networkChaosLevel !== "none" && options.env !== "local") {
    console.error("\n❌ Error: Network chaos testing requires --env local");
    console.error(
      "Network chaos manipulates Docker containers which are only available in local environment.\n",
    );
    process.exit(1);
  }

  // Build RuntimeConfig for logging and running tests
  const runtimeConfig = buildRuntimeConfig(options);

  // Log fork matrix parameters once
  printConfig(runtimeConfig);

  console.info(`Running fork detection process ${options.count} time(s)...\n`);

  const stats = {
    totalRuns: 0,
    forksDetected: 0,
    runsWithForks: 0,
    runsWithoutForks: 0,
    runsWithErrors: 0,
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
    const success = runForkTest(options, runtimeConfig);
    if (!success) {
      stats.runsWithErrors++;
      console.info(`❌ Error in run ${i}/${options.count}`);
    }

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
  }

  // Display final statistics
  console.info("\n" + "=".repeat(60));
  console.info("FORK DETECTION STATISTICS");
  console.info("=".repeat(60));
  console.info(`Total runs: ${stats.totalRuns}`);
  console.info(`Total forks detected: ${stats.forksDetected}`);
  console.info(`Runs with forks: ${stats.runsWithForks}`);
  console.info(`Runs without forks: ${stats.runsWithoutForks}`);
  console.info(`Runs with errors: ${stats.runsWithErrors}`);
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
  // Helper function to parse boolean from env var
  const getBoolEnv = (key: string, defaultValue: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
  };

  // Helper function to parse number from env var
  const getNumberEnv = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: yarn fork [options]")
    .option("count", {
      type: "number",
      default: getNumberEnv("FORK_COUNT", 100),
      describe: "Number of times to run the fork detection process",
    })
    .option("clean-all", {
      type: "boolean",
      default: getBoolEnv("FORK_CLEAN_ALL", false),
      describe: "Clean all raw logs before starting",
    })
    .parserConfiguration({
      "boolean-negation": true,
    })
    .option("remove-non-matching", {
      type: "boolean",
      default: getBoolEnv("FORK_REMOVE_NON_MATCHING", true),
      describe: "Remove logs that don't contain fork content",
    })
    .option("env", {
      type: "string",
      choices: ["local", "dev", "production"] as const,
      default:
        (process.env.XMTP_ENV as "local" | "dev" | "production") || "local",
      describe: "XMTP environment",
    })
    .option("network-chaos-level", {
      type: "string",
      choices: ["none", "low", "medium", "high"] as const,
      default:
        (process.env.FORK_NETWORK_CHAOS_LEVEL as NetworkChaosLevel) || "none",
      describe: "Network chaos level (requires --env local)",
    })
    .option("db-chaos-level", {
      type: "string",
      choices: ["none", "low", "medium", "high"] as const,
      default: (process.env.FORK_DB_CHAOS_LEVEL as DbChaosLevel) || "none",
      describe: "Database chaos level with presets",
    })
    .option("with-background-streams", {
      type: "boolean",
      default: getBoolEnv("FORK_WITH_BACKGROUND_STREAMS", false),
      describe: "Enable message streams on all workers",
    })
    .option("log-level", {
      type: "string",
      default: process.env.LOG_LEVEL || process.env.FORK_LOG_LEVEL || "warn",
      describe: "Log level for test runner (e.g., debug, info, warn, error)",
    })
    .option("group-count", {
      type: "number",
      default: getNumberEnv("FORK_GROUP_COUNT", 5),
      describe: "Number of groups to run the test against",
    })
    .option("parallel-operations", {
      type: "number",
      default: getNumberEnv("FORK_PARALLEL_OPERATIONS", 5),
      describe: "Number of parallel operations run on each group",
    })
    .option("target-epoch", {
      type: "number",
      default: getNumberEnv("FORK_TARGET_EPOCH", 20),
      describe: "Target epoch to stop the test at",
    })
    .example("yarn fork", "Run 100 times and get stats")
    .example("yarn fork --count 50", "Run 50 times")
    .example("yarn fork --clean-all", "Clean all raw logs before starting")
    .example(
      "yarn fork --count 200 --env local",
      "Run 200 times on local environment",
    )
    .example(
      "yarn fork --env local --network-chaos-level medium",
      "Run with medium network chaos",
    )
    .example(
      "yarn fork --env local --network-chaos-level high",
      "Run with high network chaos",
    )
    .example(
      "yarn fork --with-background-streams",
      "Run with message streams enabled",
    )
    .example(
      "yarn fork --db-chaos-level medium",
      "Run with medium database locking chaos",
    )
    .example(
      "yarn fork --no-remove-non-matching",
      "Keep logs that don't contain fork content",
    )
    .epilogue("For more information, see: forks/README.md")
    .help()
    .alias("h", "help")
    .strict()
    .parseAsync();

  const options: ForkOptions = {
    count: argv.count,
    cleanAll: argv["clean-all"],
    removeNonMatching: argv["remove-non-matching"],
    env: argv.env,
    networkChaosLevel: argv["network-chaos-level"] as NetworkChaosLevel,
    dbChaosLevel: argv["db-chaos-level"] as DbChaosLevel,
    withBackgroundStreams: argv["with-background-streams"],
    logLevel: argv["log-level"],
    groupCount: argv["group-count"],
    parallelOperations: argv["parallel-operations"],
    targetEpoch: argv["target-epoch"],
  };

  await runForkDetection(options);
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
