import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
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

    beforeAll(async () => {
      //fs.rmSync(".data", { recursive: true, force: true });
      // Use getWorkers to spin up many personas. This is resource-intensive.
      personas = await getWorkers(receiverAmount, testName);
      group = await personas.bob.client!.conversations.newGroupByInboxIds(
        Object.values(personas).map((p) => p.client?.inboxId as string),
      );
      expect(group.id).toBeDefined();
    });

    afterAll(async () => {
      try {
        await closeEnv(testName, personas);
      } catch (error) {
        // Catch and log any errors during cleanup to prevent them from failing the test
        console.error(`Error during test cleanup: ${error}`);
        if (
          error instanceof Error &&
          error.message.includes("Hpke error: Key not found")
        ) {
          console.log(`Ignoring expected HPKE key cleanup error in afterAll`);
        }
      }
    });

    it("tc_stream: send the stream", async () => {
      // Create a new group conversation with Bob (creator), Joe, Alice, Charlie, Dan, Eva, Frank, Grace, Henry, Ivy, and Sam.
      group = await personas.bob.client!.conversations.newGroup(
        Object.values(personas).map(
          (p) => p.client?.accountAddress as `0x${string}`,
        ),
      );
      console.log("Group created", group.id);
      expect(group.id).toBeDefined();

      // Collect messages by setting up listeners before sending and then sending known messages.
      collectedMessages = await verifyStream(
        group,
        Object.values(personas),
        "text",
        amountofMessages,
        (index) => `gm-${index + 1}-${randomSuffix}`,
      );
      console.log("allReceived", collectedMessages.allReceived);
      expect(collectedMessages.allReceived).toBe(true);
    });

    it("tc_stream_order: verify message order when receiving via streams", () => {
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
    });

    it("tc_poll_order: verify message order when receiving via pull", async () => {
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
    });
  },
  timeoutMax,
);
