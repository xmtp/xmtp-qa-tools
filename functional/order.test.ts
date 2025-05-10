import { loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { getWorkersFromGroup } from "@helpers/groups";
import { logError } from "@helpers/logger";
import { calculateMessageStats } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
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
  beforeAll(async () => {
    // Create a new group conversation with Bob (creator), Joe, Alice, Charlie, Dan, Eva, Frank, Grace, Henry, Ivy, and Sam.
    group = await workers
      .get("bob")!
      .client.conversations.newGroup(
        workers.getWorkers().map((p) => p.client.inboxId),
      );

    for (let i = 0; i < amount; i++) {
      await group.send(`gm-${i + 1}-${randomSuffix}`);
    }
  });
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
      const workersFromGroup = await getWorkersFromGroup(group, workers);
      const messagesByWorker: string[][] = [];

      for (const worker of workersFromGroup) {
        const conversation =
          await worker.client.conversations.getConversationById(group.id);
        if (!conversation) {
          throw new Error("Conversation not found");
        }
        const messages = await conversation.messages();
        const filteredMessages: string[] = [];

        for (const message of messages) {
          if (
            message.contentType?.typeId === "text" &&
            (message.content as string).includes(randomSuffix)
          ) {
            filteredMessages.push(message.content as string);
          }
        }

        messagesByWorker.push(filteredMessages);
      }

      const stats = calculateMessageStats(
        workers.getWorkers(),
        messagesByWorker,
        "gm-",
        amount,
        randomSuffix,
      );

      expect(stats.receptionPercentage).toBeGreaterThan(95);
      expect(stats.orderPercentage).toBeGreaterThan(95);

      sendDeliveryMetric(
        stats.receptionPercentage,
        workers.getWorkers()[1].sdkVersion,
        workers.getWorkers()[1].libXmtpVersion,
        testName,
        "poll",
        "delivery",
      );
      sendDeliveryMetric(
        stats.orderPercentage,
        workers.getWorkers()[1].sdkVersion,
        workers.getWorkers()[1].libXmtpVersion,
        testName,
        "poll",
        "order",
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
