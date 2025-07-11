/**
 * # Stress Test: Bot Response Rate Limiting
 *
 * ## Purpose
 * This test validates bot response reliability under XMTP network rate limiting conditions.
 * It creates a large number of concurrent workers that send messages to a target bot and
 * measures response success rates and timing under load.
 *
 * ## Test Configuration
 * - **WORKER_COUNT**: 500 concurrent workers sending messages
 * - **MESSAGES_PER_WORKER**: 1 message per worker (500 total messages)
 * - **SUCCESS_THRESHOLD**: 99% - minimum success rate required per worker
 * - **BATCH_SIZE**: 50 - workers are processed in batches to manage load
 * - **DEFAULT_STREAM_TIMEOUT_MS**: 50s timeout for bot responses
 * - **Target Bot**: Uses hardcoded inbox ID for consistent testing
 *
 * ## XMTP Network Rate Limits (Being Tested)
 * - **Read operations**: 20,000 requests per 5-minute window
 * - **Write operations**: 3,000 messages published per 5-minute window
 *
 * ## Expected Behavior
 * Each worker should:
 * 1. Create a DM conversation with the target bot
 * 2. Send a timestamped message
 * 3. Receive a bot response within the timeout period
 * 4. Achieve >99% success rate for message delivery
 *
 * ## Metrics Tracked
 * - Individual worker success rates (must exceed 99%)
 * - Overall success percentage across all workers
 * - Response timing per worker and overall average
 * - Total messages sent and responses received
 *
 * ## Usage
 * ```bash
 * # Run the stress test
 * yarn test suites/agents/stress-test.test.ts
 *
 * # Run with debug logging
 * yarn test suites/agents/stress-test.test.ts --debug
 *
 * # Run in CI/monitoring context
 * XMTP_ENV=production yarn test suites/agents/stress-test.test.ts --no-fail --debug
 * ```
 *
 * ## Test Environment
 * - Default environment: "dev"
 * - Can be overridden with XMTP_ENV environment variable
 * - Production testing should use appropriate rate limiting awareness
 */

import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
const WORKER_COUNT = 50;
const MESSAGES_PER_WORKER = 1;
const SUCCESS_THRESHOLD = 99;
const BATCH_SIZE = 50; // Workers per batch
const DEFAULT_STREAM_TIMEOUT_MS = 50000;
const XMTP_ENV = "dev";
let targetInboxId: string = "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0";

describe(testName, async () => {
  setupTestLifecycle({ testName });
  let names: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    names.push(`fabri${i}`);
  }
  console.log(`Getting ${WORKER_COUNT} workers`);
  const workers = await getWorkers(names, { env: XMTP_ENV });

  it(`should receive ${MESSAGES_PER_WORKER} bot responses from ${WORKER_COUNT} workers in parallel with >${SUCCESS_THRESHOLD}% success rate per worker`, async () => {
    type WorkerResult = {
      workerIndex: number;
      successCount: number;
      totalAttempts: number;
      successPercentage: number;
      responseTimes: number[];
      averageResponseTime: number;
    };

    const allResults: WorkerResult[] = [];
    let totalMessagesSent = 0;

    // Calculate number of batches needed
    const numBatches = Math.ceil(WORKER_COUNT / BATCH_SIZE);
    console.log(
      `Processing ${WORKER_COUNT} workers in ${numBatches} parallel batches of ~${BATCH_SIZE} workers each`,
    );

    // Create all batch promises to run in parallel
    const batchPromises = Array.from(
      { length: numBatches },
      async (_, batchIndex) => {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, WORKER_COUNT);
        const batchWorkers = workers.getAll().slice(startIndex, endIndex);

        console.log(
          `Starting batch ${batchIndex + 1}/${numBatches} with ${batchWorkers.length} workers`,
        );

        expect(workers.getAll().length).toBe(WORKER_COUNT);

        // Process all workers in this batch in parallel
        const workerPromises = batchWorkers.map(async (worker, index) => {
          const actualWorkerIndex = startIndex + index;
          const conversation =
            (await worker.client.conversations.newDmWithIdentifier({
              identifier: targetInboxId,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;

          let successCount = 0;
          const totalAttempts = MESSAGES_PER_WORKER;
          const responseTimes: number[] = [];

          for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
            totalMessagesSent++;
            const result = await verifyBotMessageStream(
              conversation,
              [worker],
              `rate-test-worker-${actualWorkerIndex}-msg-${i}-${Date.now()}`,
              1,
              DEFAULT_STREAM_TIMEOUT_MS,
            );
            const responseTime = result?.averageEventTiming;

            if (result?.allReceived) {
              successCount++;
              responseTimes.push(responseTime ?? 0);
            }
          }

          const successPercentage = (successCount / totalAttempts) * 100;
          const averageResponseTime =
            responseTimes.length > 0
              ? responseTimes.reduce((sum, time) => sum + time, 0) /
                responseTimes.length
              : 0;

          console.log(
            `Worker ${actualWorkerIndex}: ${successCount}/${totalAttempts} bot responses received (${successPercentage.toFixed(1)}%), avg response time: ${averageResponseTime.toFixed(0)}ms`,
          );

          return {
            workerIndex: actualWorkerIndex,
            successCount,
            totalAttempts,
            successPercentage,
            responseTimes,
            averageResponseTime,
          };
        });

        // Wait for all workers in this batch to complete
        const batchResults = await Promise.all(workerPromises);
        console.log(`Batch ${batchIndex + 1}/${numBatches} completed`);
        return batchResults;
      },
    );

    // Wait for ALL batches to complete in parallel
    const allBatchResults = await Promise.all(batchPromises);
    allResults.push(...allBatchResults.flat());

    // Calculate overall statistics after all batches complete
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
        ? allResponseTimes.reduce(
            (sum: number, time: number) => sum + time,
            0,
          ) / allResponseTimes.length
        : 0;

    console.log(
      `Rate limiting test completed: ${totalResponses}/${totalAttempts} bot responses received overall (${overallPercentage.toFixed(1)}%)`,
    );
    console.log(`Total messages sent: ${totalMessagesSent}`);
    console.log(
      `Overall average response time: ${overallAverageResponseTime.toFixed(0)}ms`,
    );
  });
});
