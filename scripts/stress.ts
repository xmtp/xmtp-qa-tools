import { verifyAgentMessageStream } from "@helpers/streams";
import { getWorkers, type Worker } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import productionAgents from "../suites/agents/agents.json";
import type { AgentConfig } from "../suites/agents/helper";
import "dotenv/config";

interface StressTestConfig {
  userCount: number;
  successThreshold: number;
  streamTimeoutInSeconds: number;
  env: string;
  botAddress: string;
  agentName: string;
  workersPrefix: string;
  runs: number;
}

function parseArgs(): StressTestConfig {
  const args = process.argv.slice(2);

  const config: StressTestConfig = {
    userCount: 1000,
    successThreshold: 99,
    streamTimeoutInSeconds: 120,
    env: "production",
    botAddress: "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d",
    agentName: "",
    workersPrefix: "test",
    runs: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--users":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.userCount = val;
          } else {
            console.error(`Invalid value for --users: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--threshold":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val >= 0 && val <= 100) {
            config.successThreshold = val;
          } else {
            console.error(
              `Invalid value for --threshold: ${nextArg} (must be 0-100)`,
            );
            process.exit(1);
          }
          i++;
        }
        break;
      case "--timeout":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.streamTimeoutInSeconds = val;
          } else {
            console.error(`Invalid value for --timeout: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--env":
        if (nextArg) {
          config.env = nextArg;
          i++;
        }
        break;
      case "--address":
        if (nextArg) {
          config.botAddress = nextArg;
          i++;
        }
        break;
      case "--agent":
        if (nextArg) {
          config.agentName = nextArg;
          // Look up the agent address from agents.json
          const agent = (productionAgents as AgentConfig[]).find(
            (a) => a.name === nextArg,
          );
          if (agent) {
            config.botAddress = agent.address;
          } else {
            console.error(`Agent '${nextArg}' not found in agents.json`);
            console.error(
              "Available agents:",
              (productionAgents as AgentConfig[]).map((a) => a.name).join(", "),
            );
            process.exit(1);
          }
          i++;
        }
        break;
      case "--runs":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.runs = val;
          } else {
            console.error(`Invalid value for --runs: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return config;
}

function showHelp(): void {
  console.log(`
XMTP Stress Testing CLI Tool

Runs stress tests against XMTP bots with configurable parameters.
Tests bot response rates under high load conditions.

Usage:
  yarn cli stress [options]

Options:
  --users <number>      Number of concurrent users (default: 1000)
  --threshold <number>  Success threshold percentage (default: 99)
  --timeout <number>    Stream timeout in seconds (default: 100)
  --env <environment>   XMTP environment: local, dev, production (default: production)
  --address <address>   Bot address to test (default: 0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d)
  --agent <name>        Agent name to test (looks up address from agents.json)
  --runs <number>       Number of consecutive runs to perform (default: 1)
  --help, -h           Show this help message

Examples:
  yarn cli stress --users 200 --threshold 95
  yarn cli stress --users 1000 --threshold 95 --env production
  yarn cli stress --users 100 --timeout 60
  yarn cli stress --address 0x1234... --users 50
  yarn cli stress --agent gm --users 400
  yarn cli stress --agent bankr --users 1000 --env production
  yarn cli stress --users 500 --runs 10
  yarn cli stress --agent gm --users 200 --runs 5 --threshold 95

Description:
  This tool creates multiple worker clients and tests bot response rates
  under high load conditions. All workers are processed in parallel for
  maximum performance. Multiple consecutive runs can be performed to
  gather larger sample sizes for more reliable statistics.
  
  Key features:
  • All workers run in parallel (no batching)
  • Configurable success thresholds
  • Multiple consecutive runs for larger samples
  • Randomized worker IDs to avoid testing same users
  • Detailed performance metrics and statistics

Output:
  The tool provides detailed statistics including:
  • Overall success percentage
  • Average response times
  • Response time percentiles (median, 95th percentile)
  • Messages per second throughput
`);
}

async function runStressTest(config: StressTestConfig): Promise<void> {
  console.log("🚀 Starting XMTP Stress Test");
  console.log(`📊 Configuration:`);
  console.log(`   Users: ${config.userCount}`);
  console.log(`   Success threshold: ${config.successThreshold}%`);
  console.log(`   Stream timeout: ${config.streamTimeoutInSeconds}s`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Agent name: ${config.agentName}`);
  console.log(`   Bot address: ${config.botAddress}`);
  console.log(`   Runs: ${config.runs}`);
  console.log();

  // Generate worker names once
  const names: string[] = [];
  for (let i = 0; i < config.userCount; i++) {
    names.push(`${config.workersPrefix}${i}`);
  }

  console.log(`🔧 Initializing ${config.userCount} workers...`);
  const workers = await getWorkers(names, { env: config.env as any });
  console.log(`✅ Workers initialized successfully`);
  console.log();

  // Accumulate results across all runs
  const allRunResults: Array<{
    workerIndex: number;
    successCount: number;
    totalAttempts: number;
    successPercentage: number;
    responseTimes: number[];
    averageResponseTime: number;
  }> = [];
  let totalStartTime = Date.now();
  let totalMessagesSent = 0;
  let totalActiveTime = 0; // Track only active processing time

  for (let run = 1; run <= config.runs; run++) {
    if (config.runs > 1) {
      console.log(`🔄 Starting run ${run}/${config.runs}`);
      console.log();
    }

    console.log(`📨 Starting ${config.userCount} workers in parallel...`);
    const startTime = Date.now();

    // Count messages that will be sent (1 per worker)
    totalMessagesSent += config.userCount;

    // Process all workers in parallel
    const workerPromises = workers
      .getAll()
      .map(async (worker: any, index: number) => {
        try {
          const conversation =
            (await worker.client.conversations.newDmWithIdentifier({
              identifier: config.botAddress,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;

          let successCount = 0;
          const totalAttempts = 1;
          const responseTimes: number[] = [];

          const result = await verifyAgentMessageStream(
            conversation,
            [worker as Worker],
            `msg-${index}`,
            1,
            config.streamTimeoutInSeconds * 1000,
          );
          const responseTime = result?.averageEventTiming;

          if (result?.allReceived) {
            successCount++;
            responseTimes.push(responseTime ?? 0);
          }

          // Progress logging every 10 workers
          if ((index + 1) % 10 === 0 || index + 1 === config.userCount) {
            const progress = (((index + 1) / config.userCount) * 100).toFixed(
              1,
            );
            console.log(
              `📈 Progress: ${index + 1}/${config.userCount} (${progress}%)`,
            );
          }

          const successPercentage = (successCount / totalAttempts) * 100;

          return {
            workerIndex: index,
            successCount,
            totalAttempts,
            successPercentage,
            responseTimes,
            averageResponseTime: result?.averageEventTiming ?? 0,
          };
        } catch (error) {
          console.error(`❌ Worker ${index} failed:`, error);
          return {
            workerIndex: index,
            successCount: 0,
            totalAttempts: 1,
            successPercentage: 0,
            responseTimes: [],
            averageResponseTime: 0,
          };
        }
      });

    // Wait for all workers to complete
    const runResults = await Promise.all(workerPromises);
    allRunResults.push(...runResults);

    const endTime = Date.now();
    const runTime = endTime - startTime;
    totalActiveTime += runTime;

    if (config.runs > 1) {
      console.log(
        `✅ Run ${run}/${config.runs} completed in ${(runTime / 1000).toFixed(1)}s`,
      );
      console.log();
    }
  }

  const totalEndTime = Date.now();
  const totalTime = totalEndTime - totalStartTime;

  console.log("=".repeat(50));
  console.log("📊 STRESS TEST RESULTS");
  console.log("=".repeat(50));

  // Calculate overall statistics from all runs
  const totalResponses = allRunResults.reduce(
    (sum, result) => sum + result.successCount,
    0,
  );
  const totalAttempts = allRunResults.reduce(
    (sum, result) => sum + result.totalAttempts,
    0,
  );
  const overallPercentage = (totalResponses / totalAttempts) * 100;

  // Calculate overall average response time
  const allResponseTimes = allRunResults.flatMap(
    (result) => result.responseTimes,
  );
  const overallAverageResponseTime =
    allResponseTimes.length > 0
      ? allResponseTimes.reduce((sum, time) => sum + time, 0) /
        allResponseTimes.length
      : 0;

  // Calculate response time statistics
  const sortedResponseTimes = allResponseTimes.sort((a, b) => a - b);
  const medianResponseTime =
    sortedResponseTimes.length > 0
      ? sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)]
      : 0;
  const p95ResponseTime =
    sortedResponseTimes.length > 0
      ? sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)]
      : 0;

  console.log(`- Agent: ${config.agentName}`);
  console.log(`- Env: ${config.env}`);
  console.log(`- Runs: ${config.runs}`);
  console.log(
    `- Success Rate: ${totalResponses}/${totalAttempts} (${overallPercentage.toFixed(1)}%)`,
  );
  console.log(`- Total Execution Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(
    `- Average Response Time: ${(overallAverageResponseTime / 1000).toFixed(2)}s`,
  );
  console.log(
    `- Median Response Time: ${(medianResponseTime / 1000).toFixed(2)}s`,
  );
  console.log(
    `- 95th Percentile Response Time: ${(p95ResponseTime / 1000).toFixed(2)}s`,
  );
  console.log(
    `- Messages per Second: ${(totalMessagesSent / (totalActiveTime / 1000)).toFixed(1)}`,
  );

  // Debug: Show response time distribution
  if (sortedResponseTimes.length > 0) {
    console.log(`- Response Time Distribution:`);
    console.log(`  - Min: ${(sortedResponseTimes[0] / 1000).toFixed(2)}s`);
    console.log(
      `  - Max: ${(sortedResponseTimes[sortedResponseTimes.length - 1] / 1000).toFixed(2)}s`,
    );
    console.log(
      `  - 90th percentile: ${(sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.9)] / 1000).toFixed(2)}s`,
    );
    console.log(
      `  - 99th percentile: ${(sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] / 1000).toFixed(2)}s`,
    );
  }

  // Show threshold check
  if (overallPercentage >= config.successThreshold) {
    console.log(
      `✅ SUCCESS: ${overallPercentage.toFixed(1)}% ≥ ${config.successThreshold}% threshold`,
    );
  } else {
    console.log(
      `❌ FAILURE: ${overallPercentage.toFixed(1)}% < ${config.successThreshold}% threshold`,
    );
  }

  console.log("🏆 Test completed successfully!");

  // Exit with appropriate code
  process.exit(overallPercentage >= config.successThreshold ? 0 : 1);
}

async function main(): Promise<void> {
  try {
    const config = parseArgs();
    await runStressTest(config);
  } catch (error) {
    console.error("❌ Error running stress test:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
