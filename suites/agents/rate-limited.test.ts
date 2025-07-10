import { verifyBotMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
const WORKER_COUNT = 50;
const MESSAGES_PER_WORKER = 100;
const SUCCESS_THRESHOLD = 99;
let targetInboxId: string = "0xb45dac55ee7f7598868b270783ebc7cf157a2c55";

describe(testName, async () => {
  // Create workers for parallel message sending
  const workers = await getWorkers(WORKER_COUNT);

  it(`should send ${MESSAGES_PER_WORKER} messages from ${WORKER_COUNT} workers in parallel with >${SUCCESS_THRESHOLD}% success rate per worker`, async () => {
    // Create a conversation with the target inbox from the creator
    const processes = workers.getAll().map(async (worker, index) => {
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
            "rate-test-worker-${index}-msg-${i}-${Date.now()}",
            1, // maxRetries
          );
          const responseTime = result?.averageEventTiming;

          if (result?.allReceived) {
            successCount++;
            responseTimes.push(responseTime ?? 0);
          }
        } catch (error) {
          console.log(
            `Worker ${index} failed on message ${i}: ${String(error)}`,
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
        `Worker ${index}: ${successCount}/${totalAttempts} messages sent (${successPercentage.toFixed(1)}%), avg response time: ${averageResponseTime.toFixed(0)}ms`,
      );

      return {
        workerIndex: index,
        successCount,
        totalAttempts,
        successPercentage,
        responseTimes,
        averageResponseTime,
      };
    });

    // Wait for all workers to complete
    const results = await Promise.all(processes);

    // Verify each worker has >SUCCESS_THRESHOLD% success rate
    for (const result of results) {
      expect(result.successPercentage).toBeGreaterThan(SUCCESS_THRESHOLD);
    }

    // Calculate overall statistics
    const totalMessages = results.reduce(
      (sum, result) => sum + result.successCount,
      0,
    );
    const totalAttempts = results.reduce(
      (sum, result) => sum + result.totalAttempts,
      0,
    );
    const overallPercentage = (totalMessages / totalAttempts) * 100;

    // Calculate overall average response time
    const allResponseTimes = results.flatMap((result) => result.responseTimes);
    const overallAverageResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((sum, time) => sum + time, 0) /
          allResponseTimes.length
        : 0;

    console.log(
      `Rate limiting test completed: ${totalMessages}/${totalAttempts} messages sent overall (${overallPercentage.toFixed(1)}%)`,
    );
    console.log(
      `Overall average response time: ${overallAverageResponseTime.toFixed(0)}ms`,
    );
    console.log(
      `All ${results.length} workers achieved >${SUCCESS_THRESHOLD}% success rate`,
    );
  });
});
