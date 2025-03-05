import { closeEnv, loadEnv } from "@helpers/client";
import { sendDeliveryMetric, sendPerformanceMetric } from "@helpers/datadog";
import { defaultValues, type Conversation, type Persona } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

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
    let start: number;
    let group: Conversation;
    const randomSuffix = Math.random().toString(36).substring(2, 15);

    beforeAll(async () => {
      //fs.rmSync(".data", { recursive: true, force: true });
      // Use getWorkers to spin up many personas. This is resource-intensive.
      personas = await getWorkers(receiverAmount, testName);
    });

    beforeEach(() => {
      const testName = expect.getState().currentTestName;
      start = performance.now();
      console.time(testName);
    });

    afterAll(async () => {
      await closeEnv(testName, personas);
    });

    afterEach(function () {
      const testName = expect.getState().currentTestName;
      console.timeEnd(testName);
      if (testName) {
        void sendPerformanceMetric(
          performance.now() - start,
          testName,
          Object.values(personas)[0].version,
        );
      }
    });

    it("should create a group with the correct number of participants", async () => {
      // Try to find a group with the correct number of members
      const firstPersona = Object.values(personas)[0];
      // Create a new group conversation with Bob (creator) and all others.
      console.time("[Test] Group creation time");

      let foundExistingGroup = false;

      // Get existing conversations
      const conversations = firstPersona.client!.conversations.list();
      if (conversations.length > 0) {
        const existingGroup = conversations[0];
        await existingGroup.sync();
        const members = await existingGroup.members();
        console.log(members.length);
        if (members.length === Object.values(personas).length) {
          group = existingGroup;
          foundExistingGroup = true;
          console.log("[Test] Using existing group with ID:", group.id);
        }
      }

      // Create a new group if no suitable one was found
      if (!foundExistingGroup) {
        console.log(
          "[Test] Creating new group with",
          Object.values(personas).length,
          "participants",
        );
        group = await firstPersona.client!.conversations.newGroupByInboxIds(
          Object.values(personas).map((p) => p.client?.inboxId as string),
        );
        console.log("[Test] Created new group with ID:", group.id);
      }
      console.timeEnd("[Test] Group creation time");

      expect(group.id).toBeDefined();
    });

    it("messageDelivery: should verify message order when receiving via streams", async () => {
      // Verify that each receiver collects `amount` messages of type "text".
      console.log("[Test] Starting message verification");
      console.time("[Test] Verification time");

      const generator = (index: number) => `gm-${index + 1}-${randomSuffix}`;
      const collectedMessages = await verifyStream(
        group,
        Object.values(personas),
        "text",
        amountofMessages,
        generator,
      );

      const totalMessages = amountofMessages * (receiverAmount - 1);
      const percentageReceived =
        (collectedMessages.messages.flat().length / totalMessages) * 100;
      console.log(
        `[Test] Percentage of messages received: ${percentageReceived.toFixed(2)}%`,
      );
      expect(percentageReceived).toBeGreaterThanOrEqual(95);
      // Send message delivery metrics to DataDog
      sendDeliveryMetric(
        percentageReceived,
        Object.values(personas)[0].version,
        testName,
      );
    });

    it("should verify all participants receive the same number of messages in their conversations", async () => {
      console.log("[Test] Starting conversation message count verification");

      const personaArray = Object.values(personas);
      const messageCounts: number[] = [];
      for (const persona of personaArray) {
        // Refresh the conversation to get latest messages
        const fetched = persona.client!.conversations.getConversationById(
          group.id,
        );

        if (!fetched) {
          console.error(
            `[Test] Participant ${persona.name} doesn't have the group conversation`,
          );
          messageCounts.push(0);
          continue;
        }
        await fetched.sync();
        const messages = await fetched.messages();
        let messageCount = 0;
        for (const message of messages) {
          if (
            message.contentType?.typeId === "text" &&
            (message.content as string).includes(randomSuffix)
          ) {
            messageCount++;
          }
        }
        messageCounts.push(messageCount);
      }

      // Calculate expected total messages across all participants
      const expectedTotalMessages = amountofMessages * personaArray.length;

      // Calculate actual received messages
      const totalReceivedMessages = messageCounts.reduce(
        (acc, count) => acc + count,
        0,
      );

      const percentageReceived =
        (totalReceivedMessages / expectedTotalMessages) * 100;
      console.log(
        `[Test] Percentage of messages received: ${percentageReceived.toFixed(2)}%`,
        `(${totalReceivedMessages} of ${expectedTotalMessages} expected messages)`,
      );

      const allEqual = messageCounts.every(
        (count) => count === amountofMessages,
      );
      if (!allEqual) {
        console.log("[Test] Message count discrepancies:");
        personaArray.forEach((persona, index) => {
          if (messageCounts[index] !== amountofMessages) {
            console.log(
              `[Test] ${persona.name}: ${messageCounts[index]} (expected ${amountofMessages})`,
            );
          }
        });
      }
      expect(percentageReceived).toBeGreaterThanOrEqual(95);
      sendDeliveryMetric(
        percentageReceived,
        Object.values(personas)[0].version,
        testName,
        "poll",
      );
    });
  },
  timeoutMax,
);
