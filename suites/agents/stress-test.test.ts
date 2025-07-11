import { verifyBotMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
import type { Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

/*
- **Read operations**: 20,000 requests per 5-minute window
- **Write operations**: 3,000 messages published per 5-minute window
*/

const testName = "rate-limited";
const WORKER_COUNT = 500;
const MESSAGES_PER_WORKER = 1;
const SUCCESS_THRESHOLD = 99;
const BATCH_SIZE = 50;
const DEFAULT_STREAM_TIMEOUT_MS = 50000;
const targetInboxId =
  "f5cf570042fbf33baf3924270d6f19c5497b7c0d18e5aa8c9ad29a50c4697d25";
//"11e716d44bac4fb5e30336eef968e7b8ed1a9a9fcd0c2e7326890dd456a32aa0";

const XMTP_ENV = "dev";

describe(testName, async () => {
  let names: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    names.push(`fabri${i}`);
  }
  // Create workers for parallel message sending
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
    console.log(workers.getAll().length);
    for (let batchIndex = 0; batchIndex < BATCH_SIZE; batchIndex++) {
      // Create a conversation with the target inbox from the creator
      console.log(
        `Starting batch ${batchIndex + 1}/${BATCH_SIZE} with ${
          WORKER_COUNT / BATCH_SIZE
        } workers`,
      );
      const processes = workers
        .getAll()
        .slice(
          batchIndex * (WORKER_COUNT / BATCH_SIZE),
          (batchIndex + 1) * (WORKER_COUNT / BATCH_SIZE),
        )
        .map(async (worker, index) => {
          const actualWorkerIndex =
            batchIndex * (WORKER_COUNT / BATCH_SIZE) + index;

          const conversation = (await worker.client.conversations.newDm(
            "11e716d44bac4fb5e30336eef968e7b8ed1a9a9fcd0c2e7326890dd456a32aa0",
          )) as Conversation;
          let successCount = 0;
          const totalAttempts = MESSAGES_PER_WORKER;
          const responseTimes: number[] = [];
          console.log(`Starting worker ${actualWorkerIndex}`);
          for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
            const result = await verifyBotMessageStream(
              conversation,
              [worker],
              `rate-test-worker-${actualWorkerIndex}-msg-${i}`,
              DEFAULT_STREAM_TIMEOUT_MS,
            );
            const responseTime = result?.averageEventTiming;

            if (result?.allReceived) {
              successCount++;
              responseTimes.push(responseTime ?? 0);
            }
          }
          console.log(`Worker ${actualWorkerIndex} completed`);
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
      const batchResults = await Promise.all(processes);
      allResults.push(...batchResults);

      console.log(`Batch ${batchIndex + 1}/${BATCH_SIZE} completed`);
    }

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

    // Verify each worker has >SUCCESS_THRESHOLD% success rate
    for (const result of allResults) {
      expect(result.successPercentage).toBeGreaterThan(SUCCESS_THRESHOLD);
    }
  });
});
