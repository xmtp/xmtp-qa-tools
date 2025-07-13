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
  retryFailedUsers: boolean;
  maxRetries: number;
}

interface WorkerResult {
  workerIndex: number;
  successCount: number;
  totalAttempts: number;
  successPercentage: number;
  responseTimes: number[];
  averageResponseTime: number;
  retryCount: number;
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
    retryFailedUsers: true,
    maxRetries: 2,
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
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }

  // Auto-calculate optimal batch size based on user count
  if (config.batchSize === 0) {
    if (config.userCount <= 50) {
      config.batchSize = Math.min(20, config.userCount);
      config.batchDelay = 500;
    } else if (config.userCount <= 100) {
      config.batchSize = 25;
      config.batchDelay = 300;
    } else if (config.userCount <= 200) {
      config.batchSize = 30;
      config.batchDelay = 200;
    } else if (config.userCount <= 400) {
      config.batchSize = 40;
      config.batchDelay = 100;
    } else {
      config.batchSize = 50;
      config.batchDelay = 50;
    }
  }

  // Auto-adjust timeout based on user count for better success rates
  if (config.userCount >= 200 && config.streamTimeoutInSeconds < 90) {
    config.streamTimeoutInSeconds = 90;
    console.log(`⚠️  Auto-adjusted timeout to ${config.streamTimeoutInSeconds}s for ${config.userCount} users`);
  }

  // If agent name is provided but no address, look it up
  if (config.agentName && !config.botAddress) {
    const agent = (productionAgents as AgentConfig[]).find(
      (a) => a.name === config.agentName,
    );
    if (agent) {
      config.botAddress = agent.address;
    } else {
      console.error(`Agent '${config.agentName}' not found in agents.json`);
      console.error(
        "Available agents:",
        (productionAgents as AgentConfig[]).map((a) => a.name).join(", "),
      );
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
  console.log(`   Retry failed users: ${config.retryFailedUsers ? "Yes" : "No"}`);
  console.log(`   Max retries: ${config.maxRetries}`);
  console.log(
    `   Adaptive batching: ${config.adaptiveBatching ? "Enabled" : "Disabled"}`,
  );
  console.log();

  // Generate random worker names without duplicates
  const names: string[] = [];
  const usedNumbers = new Set<number>();

  // Generate unique random numbers between 0-999
  for (let i = 0; i < config.userCount; i++) {
    let randomNum;
    do {
      randomNum = Math.floor(Math.random() * 1000);
    } while (usedNumbers.has(randomNum));
    usedNumbers.add(randomNum);
    names.push(`${config.workersPrefix}${randomNum}`);
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
  let failedWorkers: { worker: any; index: number }[] = [];

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
      return await processWorker(worker, actualWorkerIndex, config);
    });

    // Wait for all workers in this batch to complete
    const batchResults = await Promise.all(workerPromises);
    allResults.push(...batchResults);

    // Track failed workers for retry
    batchResults.forEach((result, index) => {
      if (result.successCount === 0) {
        failedWorkers.push({
          worker: batchWorkers[index],
          index: result.workerIndex,
        });
      }
    });

    // Update progress tracking
    totalMessagesSent += batchWorkers.length;
    const progress = ((totalMessagesSent / totalMessages) * 100).toFixed(1);
    console.log(
      `📈 Progress: ${totalMessagesSent}/${totalMessages} (${progress}%)`,
    );

    // Calculate batch success rate for adaptive batching
    const batchSuccessRate =
      (batchResults.reduce((sum, result) => sum + result.successCount, 0) /
        batchResults.reduce((sum, result) => sum + result.totalAttempts, 0)) *
      100;

    console.log(
      `✅ Batch ${batchIndex + 1}/${numBatches} completed - Success rate: ${batchSuccessRate.toFixed(1)}%`,
    );

    // Adaptive batching: adjust batch size based on success rate
    if (config.adaptiveBatching) {
      if (batchSuccessRate < 70 && currentBatchSize > 15) {
        currentBatchSize = Math.max(15, Math.floor(currentBatchSize * 0.6));
        console.log(
          `⚠️  Reducing batch size to ${currentBatchSize} due to low success rate`,
        );
      } else if (batchSuccessRate > 95 && currentBatchSize < config.batchSize) {
        currentBatchSize = Math.min(config.batchSize, currentBatchSize + 5);
        console.log(
          `⬆️  Increasing batch size to ${currentBatchSize} due to high success rate`,
        );
      }
      
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

  // Retry failed workers if enabled
  if (config.retryFailedUsers && failedWorkers.length > 0) {
    console.log();
    console.log(`🔄 Retrying ${failedWorkers.length} failed workers...`);
    
    for (let retryAttempt = 1; retryAttempt <= config.maxRetries; retryAttempt++) {
      if (failedWorkers.length === 0) break;

      console.log(`🔄 Retry attempt ${retryAttempt}/${config.maxRetries} for ${failedWorkers.length} workers`);
      
      const retryPromises = failedWorkers.map(async ({ worker, index }) => {
        return await processWorker(worker, index, config, retryAttempt);
      });

      const retryResults = await Promise.all(retryPromises);
      
      // Update results and remove successful retries
      const newFailedWorkers: { worker: any; index: number }[] = [];
      retryResults.forEach((result, i) => {
        const originalIndex = allResults.findIndex(r => r.workerIndex === result.workerIndex);
        if (originalIndex !== -1) {
          allResults[originalIndex] = result;
        }
        
        if (result.successCount === 0) {
          newFailedWorkers.push(failedWorkers[i]);
        }
      });

      failedWorkers = newFailedWorkers;
      const retrySuccessRate = ((retryResults.length - failedWorkers.length) / retryResults.length) * 100;
      console.log(`✅ Retry ${retryAttempt} completed - Success rate: ${retrySuccessRate.toFixed(1)}%`);
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
  const overallSuccessRate = (totalResponses / totalAttempts) * 100;

  // Calculate response time statistics
  const allResponseTimes = allResults.flatMap(
    (result: WorkerResult) => result.responseTimes,
  );
  const averageResponseTime =
    allResponseTimes.length > 0
      ? allResponseTimes.reduce((sum: number, time: number) => sum + time, 0) /
        allResponseTimes.length
      : 0;

  // Calculate median response time
  const sortedResponseTimes = allResponseTimes.sort((a, b) => a - b);
  const medianResponseTime =
    sortedResponseTimes.length > 0
      ? sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)]
      : 0;

  // Calculate 95th percentile response time
  const p95ResponseTime =
    sortedResponseTimes.length > 0
      ? sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)]
      : 0;

  const messagesPerSecond = totalResponses / (totalTime / 1000);

  console.log(`📊 Overall Success Rate: ${totalResponses}/${totalAttempts} (${overallSuccessRate.toFixed(1)}%)`);
  console.log(`⏱️  Total Execution Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`🎯 Average Response Time: ${averageResponseTime.toFixed(0)}ms`);
  console.log(`📈 Median Response Time: ${medianResponseTime.toFixed(0)}ms`);
  console.log(`🔥 95th Percentile Response Time: ${p95ResponseTime.toFixed(0)}ms`);
  console.log(`⚡ Messages per Second: ${messagesPerSecond.toFixed(1)}`);
  console.log();

  if (overallSuccessRate >= config.successThreshold) {
    console.log(`✅ SUCCESS: ${overallSuccessRate.toFixed(1)}% >= ${config.successThreshold}% threshold`);
    console.log();
    console.log(`🏆 Test completed successfully!`);
    process.exit(0);
  } else {
    console.log(`❌ FAILURE: ${overallSuccessRate.toFixed(1)}% < ${config.successThreshold}% threshold`);
    console.log();
    console.log(`🏆 Test completed successfully!`);
    process.exit(1);
  }
}

async function processWorker(
  worker: any,
  workerIndex: number,
  config: StressTestConfig,
  retryAttempt: number = 0
): Promise<WorkerResult> {
  try {
    const conversation =
      (await worker.client.conversations.newDmWithIdentifier({
        identifier: config.botAddress,
        identifierKind: IdentifierKind.Ethereum,
      })) as Conversation;

    let successCount = 0;
    const totalAttempts = 1;
    const responseTimes: number[] = [];

    // Increase timeout for retries (streamTimeoutInSeconds is already in seconds, convert to milliseconds)
    const timeout = retryAttempt > 0 
      ? config.streamTimeoutInSeconds * 1000 * (1 + retryAttempt * 0.5)
      : config.streamTimeoutInSeconds * 1000;

    const result = await verifyAgentMessageStream(
      conversation,
      [worker],
      `msg-${workerIndex}`,
      1,
      timeout,
    );
    const responseTime = result?.averageEventTiming;

    if (result?.allReceived) {
      successCount++;
      responseTimes.push(responseTime ?? 0);
    }

    const successPercentage = (successCount / totalAttempts) * 100;
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    return {
      workerIndex,
      successCount,
      totalAttempts,
      successPercentage,
      responseTimes,
      averageResponseTime,
      retryCount: retryAttempt,
    };
  } catch (error) {
    console.error(`❌ Worker ${workerIndex} failed:`, error);
    return {
      workerIndex,
      successCount: 0,
      totalAttempts: 1,
      successPercentage: 0,
      responseTimes: [],
      averageResponseTime: 0,
      retryCount: retryAttempt,
    };
  }
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
