import { verifyBotMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
const WORKER_COUNT = 150;
const MESSAGES_PER_WORKER = 1000 / WORKER_COUNT;
const SUCCESS_THRESHOLD = 99;
let targetInboxId: string = "0x163C3AFf82D7C350d9f41730FC95C43243A357d0";

describe(testName, async () => {
  let names: string[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    names.push(`fabri${i}`);
  }
  // Create workers for parallel message sending
  const workers = await getWorkers(names);

  it(`should receive ${MESSAGES_PER_WORKER} bot responses from ${WORKER_COUNT} workers in parallel with >${SUCCESS_THRESHOLD}% success rate per worker`, async () => {
    expect(workers.getAll().length).toBe(WORKER_COUNT);
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
          );
          const responseTime = result?.averageEventTiming;

          if (result?.allReceived) {
            successCount++;
            responseTimes.push(responseTime ?? 0);
          }
        } catch (error) {
          console.log(
            `Worker ${index} failed to receive response ${i}: ${String(error)}`,
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
        `Worker ${index}: ${successCount}/${totalAttempts} bot responses received (${successPercentage.toFixed(1)}%), avg response time: ${averageResponseTime.toFixed(0)}ms`,
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

    // Calculate overall statistics
    const totalResponses = results.reduce(
      (sum, result) => sum + result.successCount,
      0,
    );
    const totalAttempts = results.reduce(
      (sum, result) => sum + result.totalAttempts,
      0,
    );
    const overallPercentage = (totalResponses / totalAttempts) * 100;

    // Calculate overall average response time
    const allResponseTimes = results.flatMap((result) => result.responseTimes);
    const overallAverageResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((sum, time) => sum + time, 0) /
          allResponseTimes.length
        : 0;

    console.log(
      `Rate limiting test completed: ${totalResponses}/${totalAttempts} bot responses received overall (${overallPercentage.toFixed(1)}%)`,
    );
    console.log(
      `Overall average response time: ${overallAverageResponseTime.toFixed(0)}ms`,
    );

    // Verify each worker has >SUCCESS_THRESHOLD% success rate
    for (const result of results) {
      expect(result.successPercentage).toBeGreaterThan(SUCCESS_THRESHOLD);
    }
  });
});
