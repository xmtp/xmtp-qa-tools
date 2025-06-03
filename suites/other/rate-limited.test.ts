import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    ["henry", "ivy", "jack", "karen", "larry", "mary", "nancy", "oscar"],
    testName,
    typeofStream.Message,
    typeOfResponse.Gm,
    typeOfSync.Both,
    "production",
  );

  let targetInboxId: string;

  setupTestLifecycle({ expect });

  it("massiveBurstFromWorkerThreads: should use actual worker threads to send messages in parallel", async () => {
    try {
      // Use ivy as the target that everyone will message
      targetInboxId = workers.getCreator().client.inboxId;
      expect(targetInboxId).toBeDefined();
      const messagesPerWorker = 5000; // Each worker thread sends 500 messages
      const allWorkers = workers
        .getAllButCreator()
        .filter((w) => w.client.inboxId !== targetInboxId); // Exclude target

      console.log(
        `🚀 LAUNCHING ${allWorkers.length} WORKER THREADS EACH SENDING ${messagesPerWorker} MESSAGES!`,
      );
      console.log(`🧵 Each worker runs in its own thread for TRUE parallelism`);

      // Use the actual worker threads to send messages in parallel
      const workerPromises = allWorkers.map(async (worker) => {
        try {
          console.log(`🔥 Worker thread ${worker.name} starting burst...`);

          // Initialize the worker if not already done
          if (!worker.client) {
            await worker.worker.initialize();
          }

          // Create DM in the worker thread
          const dm = await worker.client.conversations.newDm(targetInboxId);

          for (let i = 0; i < messagesPerWorker; i++) {
            const message = `${worker.name}-${i}-${Date.now()}-${Math.random()}`;
            await dm.send(message);
            console.debug(i);
          }
        } catch (e) {
          console.error(e);
        }
      });

      await Promise.all(workerPromises);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
