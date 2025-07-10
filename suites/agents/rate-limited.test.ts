import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
describe(testName, async () => {
  setupTestLifecycle({ testName });

  // Create 10 workers for parallel message sending
  const workers = await getWorkers(10);

  let targetInboxId: string = "0xb45dac55ee7f7598868b270783ebc7cf157a2c55";

  it("should send 100 messages from 10 workers in parallel with >90% success rate per worker", async () => {
    // Create a conversation with the target inbox from the creator
    const processes = workers.getAll().map(async (worker, index) => {
      const conversation =
        (await worker.client.conversations.newDmWithIdentifier({
          identifier: targetInboxId,
          identifierKind: IdentifierKind.Ethereum,
        })) as Conversation;

      let successCount = 0;
      const totalAttempts = 10;

      for (let i = 0; i < totalAttempts; i++) {
        try {
          const messageContent = `rate-test-worker-${index}-msg-${i}-${Date.now()}`;
          await conversation.send(messageContent);
          successCount++;
        } catch (error) {
          console.log(
            `Worker ${index} failed on message ${i}: ${String(error)}`,
          );
        }
      }

      const successPercentage = (successCount / totalAttempts) * 100;
      console.log(
        `Worker ${index}: ${successCount}/${totalAttempts} messages sent (${successPercentage.toFixed(1)}%)`,
      );

      return {
        workerIndex: index,
        successCount,
        totalAttempts,
        successPercentage,
      };
    });

    // Wait for all 10 processes to complete
    const results = await Promise.all(processes);

    // Verify each worker has >90% success rate
    for (const result of results) {
      expect(result.successPercentage).toBeGreaterThan(90);
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

    console.log(
      `Rate limiting test completed: ${totalMessages}/${totalAttempts} messages sent overall (${overallPercentage.toFixed(1)}%)`,
    );
    console.log(`All ${results.length} workers achieved >90% success rate`);
  });
});
