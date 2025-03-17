import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric, sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import {
  defaultValues,
  type Group,
  type VerifyStreamResult,
} from "@helpers/types";
import {
  calculateMessageStats,
  getWorkersFromGroup,
  verifyStream,
} from "@helpers/verify";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "ts_delivery";
loadEnv(testName);

const amountofMessages = parseInt(
  process.env.CLI_DELIVERY_AMOUNT ?? process.env.DELIVERY_AMOUNT ?? "10",
);
const receiverAmount = parseInt(
  process.env.CLI_DELIVERY_RECEIVERS ?? process.env.DELIVERY_RECEIVERS ?? "4",
);

console.log(
  `[${testName}] Amount of messages: ${amountofMessages}, Receivers: ${receiverAmount}`,
);
// 2 seconds per message, multiplied by the total number of participants
// valiable for github actions
const timeoutMax =
  amountofMessages * receiverAmount * defaultValues.perMessageTimeout;

describe(
  testName,
  () => {
    let workers: WorkerManager;
    let group: Group;
    let collectedMessages: VerifyStreamResult;
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    let hasFailures = false;
    beforeAll(async () => {
      try {
        //fs.rmSync(".data", { recursive: true, force: true });
        // Use getWorkers to spin up many workers. This is resource-intensive.
        workers = await getWorkers(receiverAmount, testName);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("creating group");
        group = await workers
          .get("bob")!
          .client.conversations.newGroup([
            ...workers.getWorkers().map((p) => p.client.inboxId),
          ]);

        expect(workers).toBeDefined();
        expect(workers.getWorkers().length).toBe(receiverAmount);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    afterAll(async () => {
      try {
        sendTestResults(hasFailures, testName);
        await closeEnv(testName, workers);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    it("tc_stream: send the stream", async () => {
      try {
        expect(group.id).toBeDefined();

        // Collect messages by setting up listeners before sending and then sending known messages.
        collectedMessages = await verifyStream(
          group,
          workers.getWorkers(),
          "text",
          amountofMessages,
          (index) => `gm-${index + 1}-${randomSuffix}`,
        );
        expect(collectedMessages.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    it("tc_stream_order: verify message order when receiving via streams", () => {
      try {
        // Group messages by worker
        const messagesByWorker: string[][] = [];

        // Normalize the collectedMessages structure to match the pull test
        for (let i = 0; i < collectedMessages.messages.length; i++) {
          messagesByWorker.push(collectedMessages.messages[i]);
        }

        const stats = calculateMessageStats(
          messagesByWorker,
          "gm-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95);

        sendDeliveryMetric(
          stats.receptionPercentage,
          workers.get("bob")!.version,
          testName,
          "stream",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          workers.get("bob")!.version,
          testName,
          "stream",
          "order",
        );
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    it("tc_poll_order: verify message order when receiving via pull", async () => {
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
          messagesByWorker,
          "gm-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95); // At least some workers should have correct order

        sendDeliveryMetric(
          stats.receptionPercentage,
          workers.get("bob")!.version,
          testName,
          "poll",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          workers.get("bob")!.version,
          testName,
          "poll",
          "order",
        );
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    it("tc_offline_recovery: verify message recovery after disconnection", async () => {
      try {
        // Select one worker to take offline
        const offlineWorker = workers.get("bob")!; // Second worker
        const onlineWorker = workers.get("alice")!; // First worker

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
          await conversation!.send(message);
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

        sendDeliveryMetric(
          stats.receptionPercentage,
          offlineWorker.version,
          testName,
          "recovery",
          "delivery",
        );
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
