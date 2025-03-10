import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric, sendTestResults } from "@helpers/datadog";
import {
  defaultValues,
  type Group,
  type Persona,
  type VerifyStreamResult,
} from "@helpers/types";
import {
  calculateMessageStats,
  getPersonasFromGroup,
  verifyStream,
} from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "ts_delivery";
loadEnv(testName);

const amountofMessages = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
const receiverAmount = parseInt(process.env.DELIVERY_RECEIVERS ?? "4");
// 2 seconds per message, multiplied by the total number of participants
// valiable for github actions
const timeoutMax =
  amountofMessages * receiverAmount * defaultValues.perMessageTimeout;

describe(
  testName,
  () => {
    let personas: Record<string, Persona>;
    let group: Group;
    let collectedMessages: VerifyStreamResult;
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    let hasFailures = false;
    beforeAll(async () => {
      //fs.rmSync(".data", { recursive: true, force: true });
      // Use getWorkers to spin up many personas. This is resource-intensive.
      personas = await getWorkers(receiverAmount, testName);
      console.log("creating group");
      group = await personas.bob.client!.conversations.newGroupByInboxIds(
        Object.values(personas).map((p) => p.client?.inboxId as string),
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      for (const persona of Object.values(personas)) {
        console.log("syncing", persona.client?.inboxId);
        await persona.client!.conversations.sync();
      }
      console.log("Group created", group.id);
    });

    afterAll(async () => {
      sendTestResults(hasFailures ? "failure" : "success", testName);
      await closeEnv(testName, personas);
    });

    it("tc_stream: send the stream", async () => {
      try {
        expect(group.id).toBeDefined();

        // Collect messages by setting up listeners before sending and then sending known messages.
        collectedMessages = await verifyStream(
          group,
          Object.values(personas),
          "text",
          amountofMessages,
          (index) => `gm-${index + 1}-${randomSuffix}`,
        );
        expect(collectedMessages.allReceived).toBe(true);
      } catch (e) {
        console.error(
          `[vitest] Test failed in ${expect.getState().currentTestName}`,
          e,
        );
        hasFailures = true;
      }
    });

    it("tc_stream_order: verify message order when receiving via streams", () => {
      try {
        // Group messages by persona
        const messagesByPersona: string[][] = [];

        // Normalize the collectedMessages structure to match the pull test
        for (let i = 0; i < collectedMessages.messages.length; i++) {
          messagesByPersona.push(collectedMessages.messages[i]);
        }

        const stats = calculateMessageStats(
          messagesByPersona,
          "gm-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95);

        sendDeliveryMetric(
          stats.receptionPercentage,
          Object.values(personas)[0].version,
          testName,
          "stream",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          Object.values(personas)[0].version,
          testName,
          "stream",
          "order",
        );
      } catch (e) {
        console.error(
          `[vitest] Test failed in ${expect.getState().currentTestName}`,
          e,
        );
        hasFailures = true;
      }
    });

    it("tc_poll_order: verify message order when receiving via pull", async () => {
      try {
        const personasFromGroup = await getPersonasFromGroup(group, personas);
        const messagesByPersona: string[][] = [];

        for (const persona of personasFromGroup) {
          const conversation =
            await persona.client!.conversations.getConversationById(group.id);
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

          messagesByPersona.push(filteredMessages);
        }

        const stats = calculateMessageStats(
          messagesByPersona,
          "gm-",
          amountofMessages,
          randomSuffix,
        );

        // We expect all messages to be received and in order
        expect(stats.receptionPercentage).toBeGreaterThan(95);
        expect(stats.orderPercentage).toBeGreaterThan(95); // At least some personas should have correct order

        sendDeliveryMetric(
          stats.receptionPercentage,
          Object.values(personas)[0].version,
          testName,
          "poll",
          "delivery",
        );
        sendDeliveryMetric(
          stats.orderPercentage,
          Object.values(personas)[0].version,
          testName,
          "poll",
          "order",
        );
      } catch (e) {
        console.error(
          `[vitest] Test failed in ${expect.getState().currentTestName}`,
          e,
        );
        hasFailures = true;
      }
    });
  },
  timeoutMax,
);
