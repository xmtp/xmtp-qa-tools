import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { type Group, type WorkerManager } from "@helpers/types";
import { calculateMessageStats } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "recovery";
loadEnv(testName);

const amountofMessages = 10;
const participants = ["random1", "random2", "random3"];
const timeoutMax = 60000; // 1 minute timeout

describe(
  testName,
  () => {
    let workers: WorkerManager;
    let group: Group;
    let hasFailures = false;
    const randomSuffix = Math.random().toString(36).substring(2, 10);

    beforeAll(async () => {
      try {
        // Create workers for testing
        workers = await getWorkers(participants, testName);
        // Create a group conversation
        group = await workers
          .get("random1")!
          .client.conversations.newGroup(
            workers.getWorkers().map((p) => p.client.inboxId),
          );

        console.log("Group created", group.id);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    afterAll(async () => {
      try {
        await closeEnv(testName, workers);
        console.log(hasFailures);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it("tc_offline_recovery: verify message recovery after disconnection", async () => {
      try {
        // Select one worker to take offline
        const offlineWorker = workers.get("random2")!; // Second worker
        const onlineWorker = workers.get("random1")!; // First worker

        console.log(`Taking ${offlineWorker.name} offline`);

        // Disconnect the selected worker
        await offlineWorker.worker.terminate();

        // Send messages from an online worker
        const conversation =
          await onlineWorker.client.conversations.getConversationById(group.id);

        console.log(
          `Sending ${amountofMessages} messages while client is offline`,
        );
        for (let i = 0; i < amountofMessages; i++) {
          const message = `offline-msg-${i + 1}-${randomSuffix}`;
          await conversation?.send(message);
        }
        console.log("Sent messages");

        // Reconnect the offline worker
        console.log(`Reconnecting ${offlineWorker.name}`);
        const { client } = await offlineWorker.worker.initialize();
        offlineWorker.client = client;
        await offlineWorker.client.conversations.sync();

        // Verify message recovery
        const recoveredConversation =
          await offlineWorker.client.conversations.getConversationById(
            group.id,
          );
        await recoveredConversation?.sync();
        const messages = await recoveredConversation?.messages();

        const messagesByWorker: string[][] = [];
        const recoveredMessages: string[] = [];
        for (const message of messages ?? []) {
          if (
            message.content &&
            typeof message.content === "string" &&
            message.content.includes(`offline-msg-`) &&
            message.content.includes(randomSuffix)
          ) {
            recoveredMessages.push(message.content);
          }
        }

        messagesByWorker.push(recoveredMessages);

        const stats = calculateMessageStats(
          messagesByWorker,
          "offline-msg-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95); // At least some workers should have correct order

        // Use the unified sendDeliveryMetric for delivery metrics
        sendDeliveryMetric(
          stats.receptionPercentage,
          offlineWorker.version,
          testName,
          "recovery",
          "delivery",
        );

        // Use the unified sendDeliveryMetric for order metrics
        sendDeliveryMetric(
          stats.orderPercentage,
          offlineWorker.version,
          testName,
          "recovery",
          "order",
        );
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
  },
  timeoutMax,
);
