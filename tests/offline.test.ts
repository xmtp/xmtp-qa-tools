import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { type Group, type WorkerManager } from "@helpers/types";
import { calculateMessageStats } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "recovery";
loadEnv(testName);

const amountofMessages = parseInt(process.env.OFFLINE_MESSAGE_COUNT ?? "10");
const participantCount = parseInt(process.env.OFFLINE_PARTICIPANTS ?? "3");
const timeoutMax = 60000; // 1 minute timeout

describe(
  testName,
  () => {
    let personas: WorkerManager;
    let group: Group;
    let hasFailures = false;
    const randomSuffix = Math.random().toString(36).substring(2, 10);

    beforeAll(async () => {
      try {
        // Create personas for testing
        personas = await getWorkers(participantCount, testName);
        // Create a group conversation
        group = await personas
          .get("bob")!
          .client.conversations.newGroup(
            personas.getWorkers().map((p) => p.client.inboxId),
          );

        console.log("Group created", group.id);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });

    afterAll(async () => {
      try {
        await closeEnv(testName, personas);
        console.log(hasFailures);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it("tc_offline_recovery: verify message recovery after disconnection", async () => {
      try {
        // Select one persona to take offline
        const offlineWorker = personas.get("bob")!; // Second persona
        const onlineWorker = personas.get("alice")!; // First persona

        console.log(`Taking ${offlineWorker.name} offline`);

        // Disconnect the selected persona
        await offlineWorker.worker.terminate();

        // Send messages from an online persona
        const conversation =
          await onlineWorker.client.conversations.getConversationById(group.id);

        console.log(
          `Sending ${amountofMessages} messages while client is offline`,
        );
        for (let i = 0; i < amountofMessages; i++) {
          const message = `offline-msg-${i + 1}-${randomSuffix}`;
          await conversation?.send(message);
          console.log(`Sent message ${message}`);
        }

        // Reconnect the offline persona
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
        expect(stats.orderPercentage).toBeGreaterThan(95); // At least some personas should have correct order

        sendDeliveryMetric(
          stats.receptionPercentage,
          offlineWorker.version,
          testName,
          "offline",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          offlineWorker.version,
          testName,
          "offline",
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
