import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    ["henry", "ivy", "jack", "karen", "larry", "mary", "nancy", "oscar"],
    testName,
  );

  let targetInboxId: string;

  setupTestLifecycle({
    expect,
  });

  it("setup: should get target inbox for all workers to message", async () => {
    try {
      // Use ivy as the target that everyone will message
      targetInboxId = workers.get("ivy")!.client.inboxId;
      expect(targetInboxId).toBeDefined();
      console.log(`🎯 Target inbox: ${targetInboxId}`);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("massiveBurstFromAllWorkers: should have each worker send 500 messages simultaneously", async () => {
    try {
      const messagesPerWorker = 500; // Each worker sends 500 messages
      const allWorkers = workers
        .getAll()
        .filter((w) => w.client.inboxId !== targetInboxId); // Exclude target

      console.log(
        `🚀 LAUNCHING ${allWorkers.length} WORKERS EACH SENDING ${messagesPerWorker} MESSAGES!`,
      );
      console.log(
        `📊 Total messages: ${allWorkers.length * messagesPerWorker}`,
      );

      const startTime = Date.now();

      // Each worker creates DM and sends messages simultaneously
      const workerPromises = allWorkers.map(async (worker) => {
        const workerStartTime = Date.now();

        try {
          // Create DM for this worker
          const dm = await worker.client.conversations.newDm(targetInboxId);

          console.log(`🔥 Worker ${worker.name} starting burst...`);

          // Create all send promises at once for this worker
          const sendPromises = [];
          for (let i = 0; i < messagesPerWorker; i++) {
            const message = `BURST-${worker.name}-${i}-${Date.now()}-${Math.random()}`;
            sendPromises.push(dm.send(message));
          }

          // Fire all messages from this worker at once
          const results = await Promise.allSettled(sendPromises);
          const workerEndTime = Date.now();
          const workerDuration = workerEndTime - workerStartTime;

          // Count results for this worker
          const successful = results.filter(
            (r) => r.status === "fulfilled",
          ).length;
          const failed = results.filter((r) => r.status === "rejected").length;
          const successRate = ((successful / messagesPerWorker) * 100).toFixed(
            1,
          );
          const rate = ((messagesPerWorker / workerDuration) * 1000).toFixed(1);

          console.log(
            `⚡ ${worker.name}: ${successful}✅ ${failed}❌ (${successRate}% success) ${rate} msg/sec`,
          );

          // Log first few errors for this worker
          let errorCount = 0;
          results.forEach((result, index) => {
            if (result.status === "rejected" && errorCount < 3) {
              const errorMessage =
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason);
              console.log(`❌ ${worker.name}[${index}]: ${errorMessage}`);
              errorCount++;
            }
          });

          return {
            worker: worker.name,
            successful,
            failed,
            duration: workerDuration,
            rate: parseFloat(rate),
            errors: results
              .filter((r) => r.status === "rejected")
              .map((r) =>
                r.reason instanceof Error ? r.reason.message : String(r.reason),
              ),
          };
        } catch (error) {
          console.error(`💥 Worker ${worker.name} failed completely:`, error);
          return {
            worker: worker.name,
            successful: 0,
            failed: messagesPerWorker,
            duration: Date.now() - workerStartTime,
            rate: 0,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      });

      // Wait for all workers to complete their bursts
      console.log(
        `⏳ Waiting for all ${allWorkers.length} workers to complete...`,
      );
      const allResults = await Promise.all(workerPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Calculate totals
      const totalSuccessful = allResults.reduce(
        (sum, r) => sum + r.successful,
        0,
      );
      const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
      const totalMessages = totalSuccessful + totalFailed;
      const overallSuccessRate = (
        (totalSuccessful / totalMessages) *
        100
      ).toFixed(1);
      const overallRate = ((totalMessages / totalDuration) * 1000).toFixed(1);

      console.log(`\n💥 FINAL BURST RESULTS:`);
      console.log(`⏱️  Total Duration: ${totalDuration}ms`);
      console.log(`👥 Workers: ${allWorkers.length}`);
      console.log(`📨 Total Messages: ${totalMessages}`);
      console.log(`✅ Total Successful: ${totalSuccessful}`);
      console.log(`❌ Total Failed: ${totalFailed}`);
      console.log(`📊 Overall Success Rate: ${overallSuccessRate}%`);
      console.log(`⚡ Overall Rate: ${overallRate} msg/sec`);

      // Show per-worker summary
      console.log(`\n📋 PER-WORKER SUMMARY:`);
      allResults.forEach((result) => {
        const successRate = (
          (result.successful / messagesPerWorker) *
          100
        ).toFixed(1);
        console.log(
          `${result.worker}: ${result.successful}✅ ${result.failed}❌ (${successRate}%) ${result.rate} msg/sec`,
        );
      });

      // Show unique error types
      const allErrors = allResults.flatMap((r) => r.errors);
      const uniqueErrors = [...new Set(allErrors)];
      if (uniqueErrors.length > 0) {
        console.log(`\n🔍 UNIQUE ERROR TYPES (${uniqueErrors.length}):`);
        uniqueErrors.slice(0, 10).forEach((error, index) => {
          const count = allErrors.filter((e) => e === error).length;
          console.log(`${index + 1}. (${count}x) ${error}`);
        });
      }

      // We expect at least some messages to succeed
      expect(totalSuccessful).toBeGreaterThan(0);

      if (totalFailed > 0) {
        console.log(
          `\n🎯 SUCCESS! Rate limiting triggered across ${allWorkers.length} workers!`,
        );
        console.log(
          `💀 ${totalFailed} messages failed out of ${totalMessages} total`,
        );
      } else {
        console.log(
          `\n⚠️  No rate limiting detected - all ${totalMessages} messages sent successfully`,
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
