import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { getFixedNames, sleep } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "order";
loadEnv(testName);

describe(testName, async () => {
  const amount = 5; // Number of messages to collect per receiver
  let workers: WorkerManager;

  workers = await getWorkers(getFixedNames(5), testName, typeofStream.Message);

  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  setupTestLifecycle({
    expect,
  });
  it("poll_order: verify message order when receiving via pull", async () => {
    try {
      group = await workers.createGroup();
      await group.sync();
      console.log("group", group.id);
      expect(group.id).toBeDefined();

      await sleep(1000); // Allow group propagation

      // Send test messages
      for (let i = 0; i < amount; i++) {
        await group.send(`gm-${i + 1}-${randomSuffix}`);
      }

      // Collect messages from each worker
      const messagesByWorker = await Promise.all(
        workers.getAllButCreator().map(async (worker) => {
          await worker.client.conversations.syncAll();
          const conversation =
            await worker.client.conversations.getConversationById(group.id);
          if (!conversation) throw new Error("Conversation not found");

          const messages = await conversation.messages();
          return messages
            .filter(
              (m) =>
                m.contentType?.typeId === "text" &&
                (m.content as string).includes(randomSuffix),
            )
            .map((m) => m.content as string);
        }),
      );
      const stats = calculateMessageStats(
        messagesByWorker,
        "gm-",
        amount,
        randomSuffix,
      );

      expect(stats.receptionPercentage).toBeGreaterThan(95);
      expect(stats.orderPercentage).toBeGreaterThan(95);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("stream_order: verify message order when receiving via streams", async () => {
    try {
      group = await workers.createGroup();
      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
        10,
        randomSuffix,
      );
      expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
      expect(verifyResult.orderPercentage).toBeGreaterThan(95);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
