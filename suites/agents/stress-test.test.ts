import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "stress-test";
const WORKER_COUNT = 100;
const MESSAGES_PER_WORKER = 1;
const SUCCESS_THRESHOLD = 99;
const DEFAULT_STREAM_TIMEOUT_MS = 10000 * 12;
const WORKERS_PREFIX = "test";
const BATCH_SIZE = Math.ceil(WORKER_COUNT / 10);
const XMTP_ENV = "production";
const ADDRESS = "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d";

describe(testName, async () => {
  setupTestLifecycle({ testName });
  let names: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) names.push(`${WORKERS_PREFIX}-${i}`);

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
    const totalMessages = WORKER_COUNT * MESSAGES_PER_WORKER;
    console.log(
      `Processing ${WORKER_COUNT} workers in ${numBatches} parallel batches of ~${BATCH_SIZE} workers each`,
    );
    console.log(`Total messages to send: ${totalMessages}`);
    console.log(`Starting message sending process...`);

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
              identifier: ADDRESS,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;

          let successCount = 0;
          const totalAttempts = MESSAGES_PER_WORKER;
          const responseTimes: number[] = [];

          for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
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
            totalMessagesSent++;
            console.log(
              `Total messages sent: ${totalMessagesSent}/${totalMessages}`,
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
    console.log(
      `Overall average response time: ${overallAverageResponseTime.toFixed(0)}ms`,
    );
    expect(overallPercentage).toBeGreaterThan(SUCCESS_THRESHOLD);
    expect(overallAverageResponseTime).toBeLessThan(DEFAULT_STREAM_TIMEOUT_MS); // 30 seconds
  });
});
