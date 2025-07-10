import { verifyBotMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
const WORKER_COUNT = 1000;
const MESSAGES_PER_WORKER = 1;
const SUCCESS_THRESHOLD = 99;
const BATCH_SIZE = 10;
let targetInboxId: string = "0x163C3AFf82D7C350d9f41730FC95C43243A357d0";

describe(testName, async () => {
  let names: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    names.push(`fabri${i}`);
  }
  // Create workers for parallel message sending
  const workers = await getWorkers(names);

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

    for (let batchIndex = 0; batchIndex < BATCH_SIZE; batchIndex++) {
      expect(workers.getAll().length).toBe(WORKER_COUNT);

      // Create a conversation with the target inbox from the creator
      const processes = workers
        .getAll()
        .slice(
          batchIndex * (WORKER_COUNT / BATCH_SIZE),
          (batchIndex + 1) * (WORKER_COUNT / BATCH_SIZE),
        )
        .map(async (worker, index) => {
          const actualWorkerIndex =
            batchIndex * (WORKER_COUNT / BATCH_SIZE) + index;
          const conversation =
            (await worker.client.conversations.newDmWithIdentifier({
              identifier: targetInboxId,
              identifierKind: IdentifierKind.Ethereum,
            })) as Conversation;

          let successCount = 0;
          const totalAttempts = MESSAGES_PER_WORKER;
          const responseTimes: number[] = [];

          for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
            try {
              const result = await verifyBotMessageStream(
                conversation,
                [worker],
                `rate-test-worker-${actualWorkerIndex}-msg-${i}-${Date.now()}`,
              );
              const responseTime = result?.averageEventTiming;

              if (result?.allReceived) {
                successCount++;
                responseTimes.push(responseTime ?? 0);
              }
            } catch (error) {
              console.log(
                `Worker ${actualWorkerIndex} failed to receive response ${i}: ${String(error)}`,
              );
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
