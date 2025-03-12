import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { logError } from "@helpers/tests";
import { type Group, type NestedPersonas } from "@helpers/types";
import { calculateMessageStats } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "recovery";
loadEnv(testName);

const amountofMessages = parseInt(process.env.OFFLINE_MESSAGE_COUNT ?? "10");
const participantCount = parseInt(process.env.OFFLINE_PARTICIPANTS ?? "3");
const timeoutMax = 60000; // 1 minute timeout

describe(
  testName,
  () => {
    let personas: NestedPersonas;
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
          .client!.conversations.newGroup(
            personas.getPersonas().map((p) => p.client?.inboxId as string),
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
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it("tc_offline_recovery: verify message recovery after disconnection", async () => {
      try {
        // Select one persona to take offline
        const offlinePersona = personas.get("bob")!; // Second persona
        const onlinePersona = personas.get("alice")!; // First persona

        console.log(`Taking ${offlinePersona.name} offline`);

        // Disconnect the selected persona
        await offlinePersona.worker!.terminate();

        // Send messages from an online persona
        const conversation =
          await onlinePersona.client!.conversations.getConversationById(
            group.id,
          );

        console.log(
          `Sending ${amountofMessages} messages while client is offline`,
        );
        for (let i = 0; i < amountofMessages; i++) {
          const message = `offline-msg-${i + 1}-${randomSuffix}`;
          await conversation!.send(message);
          console.log(`Sent message ${message}`);
        }

        // Reconnect the offline persona
        console.log(`Reconnecting ${offlinePersona.name}`);
        const { client } = await offlinePersona.worker!.initialize();
        offlinePersona.client = client;
        await offlinePersona.client.conversations.sync();

        // Verify message recovery
        const recoveredConversation =
          await offlinePersona.client.conversations.getConversationById(
            group.id,
          );
        await recoveredConversation?.sync();
        const messages = await recoveredConversation?.messages();

        const messagesByPersona: string[][] = [];
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

        messagesByPersona.push(recoveredMessages);

        const stats = calculateMessageStats(
          messagesByPersona,
          "offline-msg-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95); // At least some personas should have correct order

        sendDeliveryMetric(
          stats.receptionPercentage,
          offlinePersona.version,
          testName,
          "offline",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          offlinePersona.version,
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
