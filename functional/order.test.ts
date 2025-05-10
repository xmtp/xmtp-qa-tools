import { loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { getWorkersFromGroup } from "@helpers/groups";
import { logError } from "@helpers/logger";
import { calculateMessageStats } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { create } from "node_modules/axios/index.cjs";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "order";
loadEnv(testName);

describe(testName, async () => {
  const amount = 5; // Number of messages to collect per receiver
  let workers: WorkerManager;

  let start: number;
  let testStart: number;
  workers = await getWorkers(getRandomNames(5), testName);

  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  setupTestLifecycle({
    expect,
    workers,
    testName,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });
  it("poll_order: verify message order when receiving via pull", async () => {
    try {
      const creator = workers.getCreator();
      group = await creator.client.conversations.newGroup(
        workers.getAllButCreator().map((p) => p.client.inboxId),
      );
      await group.sync();
      console.log("group", group.id);
      expect(group.id).toBeDefined();

      await new Promise((r) => setTimeout(r, 1000)); // Allow group propagation

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
});
