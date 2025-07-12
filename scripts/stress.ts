/**
 * XMTP Stress Testing CLI Tool
 *
 * Runs stress tests against XMTP bots with configurable parameters.
 * Tests bot response rates under high load conditions.
 *
 * Usage: yarn cli stress [options]
 *
 * Options:
 *   --users <number>      Number of concurrent users (default: 1000)
 *   --msgs <number>       Messages per user (default: 1)
 *   --threshold <number>  Success threshold percentage (default: 99)
 *   --timeout <number>    Stream timeout in milliseconds (default: 120000)
 *   --env <environment>   XMTP environment (default: production)
 *   --address <address>   Bot address to test (default: 0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d)
 *   --batch-size <number> Batch size for parallel processing (default: calculated)
 *   --help, -h           Show this help message
 */

import { verifyAgentMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
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
  batchSize: number;
  workersPrefix: string;
  maxConcurrent: number;
  batchDelay: number;
  adaptiveBatching: boolean;
}

interface WorkerResult {
  workerIndex: number;
  successCount: number;
  totalAttempts: number;
  successPercentage: number;
  responseTimes: number[];
  averageResponseTime: number;
}

function parseArgs(): StressTestConfig {
  const args = process.argv.slice(2);

  const config: StressTestConfig = {
    userCount: 1000,
    successThreshold: 99,
    streamTimeoutInSeconds: 100,
    env: "production",
    botAddress: "", // will be set later
    agentName: "", // will be set later
    batchSize: 0, // Will be calculated
    workersPrefix: "test",
    maxConcurrent: 100, // Default for 1k users
    batchDelay: 1000, // Default for 1k users
    adaptiveBatching: true,
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
      case "--batch-size":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.batchSize = val;
          } else {
            console.error(`Invalid value for --batch-size: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--max-concurrent":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.maxConcurrent = val;
          } else {
            console.error(`Invalid value for --max-concurrent: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--batch-delay":
        if (nextArg) {
          const val = parseInt(nextArg, 10);
          if (!isNaN(val) && val > 0) {
            config.batchDelay = val;
          } else {
            console.error(`Invalid value for --batch-delay: ${nextArg}`);
            process.exit(1);
          }
          i++;
        }
        break;
      case "--no-adaptive-batching":
        config.adaptiveBatching = false;
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

  // Calculate batch size if not provided
  if (config.batchSize === 0) {
    config.batchSize = Math.min(
      config.maxConcurrent,
      Math.ceil(config.userCount / 10),
    );
  }

  // If agent name is provided but no address, look it up
  if (config.agentName) {
    const agent = (productionAgents as AgentConfig[]).find(
      (a) => a.name === config.agentName,
    );
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
  --msgs <number>       Messages per user (default: 1)
  --threshold <number>  Success threshold percentage (default: 99)
  --timeout <number>    Stream timeout in milliseconds (default: 120000)
  --env <environment>   XMTP environment: local, dev, production (default: production)
  --address <address>   Bot address to test (default: 0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d)
  --agent <name>        Agent name to test (looks up address from agents.json)
  --batch-size <number> Batch size for parallel processing (default: calculated)
  --max-concurrent <number> Max concurrent connections (default: 100)
  --batch-delay <number> Delay between batches in milliseconds (default: 1000)
  --no-adaptive-batching Disable adaptive batching
  --help, -h           Show this help message

Examples:
  yarn cli stress --users 200 --msgs 2
  yarn cli stress --users 1000 --threshold 95 --env production
  yarn cli stress --users 100 --msgs 5 --timeout 60000
  yarn cli stress --address 0x1234... --users 50
  yarn cli stress --agent gm --users 400 --msgs 1
  yarn cli stress --agent bankr --users 1000 --env production --max-concurrent 50
  yarn cli stress --users 1000 --batch-delay 2000 --no-adaptive-batching

Description:
  This tool creates multiple worker clients and tests bot response rates
  under high load conditions. Workers are processed in sequential batches
  to optimize performance and prevent overwhelming the system.
  
  Key features:
  • Sequential batch processing for better resource management
  • Adaptive batching that reduces batch size on failures
  • Configurable rate limiting between batches
  • Randomized worker IDs from pool of 1000 to avoid testing same users
  • Optimized for scaling to 1000+ concurrent users

Output:
  The tool provides detailed statistics including:
  • Overall success percentage
  • Average response times
  • Per-batch success rates
  • Batch processing progress with adaptive sizing
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
  console.log(`   Batch size: ${config.batchSize}`);
  console.log(`   Max concurrent: ${config.maxConcurrent}`);
  console.log(`   Batch delay: ${config.batchDelay}ms`);
  console.log(
    `   Adaptive batching: ${config.adaptiveBatching ? "Enabled" : "Disabled"}`,
  );
  console.log();

  // Generate random worker names without duplicates
  // Generate random worker names without duplicates
  const names: string[] = [];
  const usedNumbers = new Set<number>();

  // Generate unique random numbers between 0-999
  for (let i = 0; i < config.userCount; i++) {
    const randomNum = Math.floor(Math.random() * 1000);
    if (!usedNumbers.has(randomNum)) {
      usedNumbers.add(randomNum);
      names.push(`${config.workersPrefix}${randomNum}`);
    }
  }

  console.log(`🔧 Initializing ${config.userCount} workers with random IDs...`);
  const workers = await getWorkers(names, { env: config.env as any });
  console.log(`✅ Workers initialized successfully`);
  console.log();

  const allResults: WorkerResult[] = [];
  let totalMessagesSent = 0;
  const totalMessages = config.userCount * 1;

  // Calculate number of batches needed
  let currentBatchSize = config.batchSize;
  let numBatches = Math.ceil(config.userCount / currentBatchSize);

  console.log(
    `📦 Processing ${config.userCount} workers in ${numBatches} sequential batches of ~${currentBatchSize} workers each`,
  );
  console.log(`📨 Total messages to send: ${totalMessages}`);
  console.log(`⏱️  Starting message sending process...`);
  console.log();

  const startTime = Date.now();

  // Process batches sequentially for better resource management
  let processedWorkers = 0;
  let batchIndex = 0;

  while (processedWorkers < config.userCount) {
    const startIndex = processedWorkers;
    const endIndex = Math.min(startIndex + currentBatchSize, config.userCount);
    const batchWorkers = workers.getAll().slice(startIndex, endIndex);

    console.log(
      `🏁 Starting batch ${batchIndex + 1}/${numBatches} with ${batchWorkers.length} workers (batch size: ${currentBatchSize})`,
    );

    // Process all workers in this batch in parallel
    const workerPromises = batchWorkers.map(async (worker, index) => {
      const actualWorkerIndex = startIndex + index;
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
          config.botAddress,
          worker,
          `msg-${actualWorkerIndex}`,
          1,
          config.streamTimeoutInSeconds * 1000,
        );
        const responseTime = result?.averageEventTiming;

        if (result?.allReceived) {
          successCount++;
          responseTimes.push(responseTime ?? 0);
        }
        totalMessagesSent++;

        if (
          totalMessagesSent % 10 === 0 ||
          totalMessagesSent === totalMessages
        ) {
          const progress = ((totalMessagesSent / totalMessages) * 100).toFixed(
            1,
          );
          console.log(
            `📈 Progress: ${totalMessagesSent}/${totalMessages} (${progress}%)`,
          );
        }

        const successPercentage = (successCount / totalAttempts) * 100;
        const averageResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length
            : 0;

        return {
          workerIndex: actualWorkerIndex,
          successCount,
          totalAttempts,
          successPercentage,
          responseTimes,
          averageResponseTime,
        };
      } catch (error) {
        console.error(`❌ Worker ${actualWorkerIndex} failed:`, error);
        return {
          workerIndex: actualWorkerIndex,
          successCount: 0,
          totalAttempts: 1,
          successPercentage: 0,
          responseTimes: [],
          averageResponseTime: 0,
        };
      }
    });

    // Wait for all workers in this batch to complete
    const batchResults = await Promise.all(workerPromises);
    allResults.push(...batchResults);

    // Calculate batch success rate for adaptive batching
    const batchSuccessRate =
      (batchResults.reduce((sum, result) => sum + result.successCount, 0) /
        batchResults.reduce((sum, result) => sum + result.totalAttempts, 0)) *
      100;

    console.log(
      `✅ Batch ${batchIndex + 1}/${numBatches} completed - Success rate: ${batchSuccessRate.toFixed(1)}%`,
    );

    // Adaptive batching: reduce batch size if success rate is low
    if (
      config.adaptiveBatching &&
      batchSuccessRate < 80 &&
      currentBatchSize > 10
    ) {
      currentBatchSize = Math.max(10, Math.floor(currentBatchSize * 0.7));
      console.log(
        `⚠️  Reducing batch size to ${currentBatchSize} due to low success rate`,
      );
      // Recalculate number of batches for remaining workers
      const remainingWorkers = config.userCount - endIndex;
      numBatches =
        batchIndex + 1 + Math.ceil(remainingWorkers / currentBatchSize);
    }

    processedWorkers = endIndex;
    batchIndex++;

    // Add delay between batches to prevent overwhelming the system
    if (processedWorkers < config.userCount && config.batchDelay > 0) {
      console.log(`⏳ Waiting ${config.batchDelay}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, config.batchDelay));
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log();
  console.log("📊 STRESS TEST RESULTS");
  console.log("=".repeat(50));

  // Calculate overall statistics
  const totalResponses = allResults.reduce(
    (sum: number, result: WorkerResult) => sum + result.successCount,
    0,
  );
  const totalAttempts = allResults.reduce(
    (sum: number, result: WorkerResult) => sum + result.totalAttempts,
    0,
  );
  const overallPercentage = (totalResponses / totalAttempts) * 100;

  // Calculate overall average response time
  const allResponseTimes = allResults.flatMap(
    (result: WorkerResult) => result.responseTimes,
  );
  const overallAverageResponseTime =
    allResponseTimes.length > 0
      ? allResponseTimes.reduce((sum: number, time: number) => sum + time, 0) /
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

  console.log(
    `📊 Overall Success Rate: ${totalResponses}/${totalAttempts} (${overallPercentage.toFixed(1)}%)`,
  );
  console.log(`⏱️  Total Execution Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(
    `🎯 Average Response Time: ${overallAverageResponseTime.toFixed(0)}ms`,
  );
  console.log(`📈 Median Response Time: ${medianResponseTime.toFixed(0)}ms`);
  console.log(
    `🔥 95th Percentile Response Time: ${p95ResponseTime.toFixed(0)}ms`,
  );
  console.log(
    `⚡ Messages per Second: ${(totalMessages / (totalTime / 1000)).toFixed(1)}`,
  );
  console.log();

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

  console.log();
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
