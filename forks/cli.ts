import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { cleanForksLogs, cleanAllRawLogs } from "@helpers/analyzer";
import "dotenv/config";

interface ForkOptions {
  count: number; // Number of times to run the process (default: 100)
  clean: boolean; // Clean logs before processing
  cleanAll: boolean; // Clean all raw logs
  removeNonMatching: boolean; // Remove non-matching logs
}

function showHelp() {
  console.log(`
XMTP Fork Detection CLI - Fork detection and analysis

USAGE:
  yarn fork [options]

OPTIONS:
  --count <number>           Number of times to run the fork detection process [default: 100]
  --clean                    Clean fork logs before processing
  --clean-all                Clean all raw logs (equivalent to ansi:clean)
  --remove-non-matching      Remove logs that don't contain fork content [default: true]
  --no-remove-non-matching   Keep logs that don't contain fork content
  -h, --help                 Show this help message

EXAMPLES:
  yarn fork                    # Run 100 times and get stats
  yarn fork --count 50          # Run 50 times
  yarn fork --clean             # Clean fork logs and get stats
  yarn fork --clean-all         # Clean all raw logs
  yarn fork --count 200 --clean # Run 200 times with cleaning

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
 * Run fork detection process and collect stats
 */
async function runForkDetection(options: ForkOptions): Promise<void> {
  console.info("=".repeat(60));
  console.info("XMTP Fork Detection CLI");
  console.info("=".repeat(60));
  console.info(`Running fork detection process ${options.count} time(s)...\n`);

  const stats = {
    totalRuns: 0,
    forksDetected: 0,
    runsWithForks: 0,
    runsWithoutForks: 0,
  };

  // Clean logs if requested
  if (options.cleanAll) {
    console.info("Cleaning all raw logs...");
    await cleanAllRawLogs();
    console.info("Finished cleaning all raw logs\n");
  }

  // Run the process N times
  for (let i = 1; i <= options.count; i++) {
    console.info(`Run ${i}/${options.count}...`);

    // Clean fork logs if requested
    if (options.clean) {
      await cleanForksLogs(options.removeNonMatching);
    }

    // Count forks detected
    const forkCount = getForkCount();
    stats.totalRuns++;
    stats.forksDetected += forkCount;

    if (forkCount > 0) {
      stats.runsWithForks++;
      console.info(`  Found ${forkCount} fork(s) in this run`);
    } else {
      stats.runsWithoutForks++;
      console.info(`  No forks detected`);
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
    clean: false,
    cleanAll: false,
    removeNonMatching: true,
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
      case "--clean":
        options.clean = true;
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
      default:
        console.error(`Unknown option: ${arg}`);
        console.error("Use --help for usage information");
        process.exit(1);
    }
  }

  await runForkDetection(options);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

