import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { sendMessageDeliveryMetric, sendMetric } from "@helpers/datadog";
import { defaultValues, type Persona } from "@helpers/types";
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

const amountofMessages = parseInt(process.env.DELIVERY_AMOUNT ?? "100");
const receivers = parseInt(process.env.DELIVERY_RECEIVERS ?? "40");
// 2 seconds per message, multiplied by the total number of participants
const timeoutMax =
  amountofMessages * receivers * defaultValues.perMessageTimeout;

describe(
  testName,

  () => {
    let personas: Record<string, Persona>;
    let start: number;

    beforeAll(async () => {
      fs.rmSync(".data", { recursive: true, force: true });
      // Use getWorkers to spin up many personas. This is resource-intensive.
      personas = await getWorkers(receivers, testName);
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
        void sendMetric(performance.now() - start, testName, personas);
      }
    });
    it("streamLoss: should verify message order when receiving via streams", async () => {
      // Create a new group conversation with Bob (creator) and all others.
      const firstPersona = Object.values(personas)[0];
      console.log(
        "[Test] Creating group with",
        Object.values(personas).length,
        "participants",
      );

      console.time("[Test] Group creation time");
      const group = await firstPersona.client!.conversations.newGroupByInboxIds(
        Object.values(personas).map((p) => p.client?.inboxId as string),
      );
      console.timeEnd("[Test] Group creation time");

      console.log("[Test] Created group with ID:", group.id);
      expect(group.id).toBeDefined();

      // Verify that each receiver collects `amount` messages of type "text".
      console.log("[Test] Starting message verification");
      console.time("[Test] Verification time");
      const collectedMessages = await verifyStream(
        group,
        Object.values(personas),
        "text",
        amountofMessages,
      );
      console.timeEnd("[Test] Verification time");

      // Evaluate how many messages were received in total
      const totalMessages = amountofMessages * (receivers - 1);
      const receivedMessagesCount = collectedMessages.messages.flat().length;
      const percentageReceived = (receivedMessagesCount / totalMessages) * 100;
      const lossRate = 100 - percentageReceived;

      console.log(
        `[Test] Total messages expected: ${totalMessages}, received: ${receivedMessagesCount}`,
      );
      console.log(
        `[Test] Percentage of messages received: ${percentageReceived}%`,
      );

      // Send message delivery metrics to DataDog
      sendMessageDeliveryMetric(
        percentageReceived,
        lossRate,
        testName,
        personas,
      );

      // We expect at least 99% to pass
      expect(percentageReceived).toBeGreaterThanOrEqual(99);
    });

    // it("should verify all participants receive the same number of messages in their conversations", async () => {
    //   console.log("[Test] Starting conversation message count verification");

    //   // Get all personas
    //   const personas = await getWorkers(receivers, testName);
    //   const personaArray = Object.values(personas);

    //   // Create a group conversation
    //   console.log("[Test] Creating group for message count test");
    //   const firstPersona = Object.values(personas)[0];
    //   const group = await firstPersona.client!.conversations.newGroupByInboxIds(
    //     personaArray.map((p) => p.client?.inboxId as string),
    //   );

    //   // Send some test messages
    //   const messagesToSend = 10;
    //   console.log(`[Test] Sending ${messagesToSend} test messages to group`);
    //   for (let i = 0; i < messagesToSend; i++) {
    //     group.send(group, {
    //       content: `Test message ${i}`,
    //       contentType: "text",
    //     });
    //   }

    //   // Wait for messages to propagate
    //   console.log("[Test] Waiting for messages to propagate");
    //   await new Promise((resolve) => setTimeout(resolve, 5000));

    //   // Check message counts for each participant
    //   console.log("[Test] Checking message counts for each participant");
    //   const messageCounts = [];

    //   for (const persona of personaArray) {
    //     // Refresh the conversation to get latest messages
    //     const refreshedConvo = await persona
    //       .client!.conversations.list()
    //       .then((convos) => convos.find((c) => c.id === group.id));

    //     if (!refreshedConvo) {
    //       console.error(
    //         `[Test] Participant ${persona.name} doesn't have the group conversation`,
    //       );
    //       messageCounts.push(0);
    //       continue;
    //     }

    //     const messages = await refreshedConvo.messages();
    //     messageCounts.push(messages.length);
    //     console.log(
    //       `[Test] Participant ${persona.name} has ${messages.length} messages`,
    //     );
    //   }

    //   // Verify all participants have the same number of messages
    //   const expectedCount = messageCounts[0];
    //   const allEqual = messageCounts.every((count) => count === expectedCount);

    //   console.log(`[Test] Expected message count: ${expectedCount}`);
    //   console.log(
    //     `[Test] All participants have same message count: ${allEqual}`,
    //   );

    //   // Check if any participants are missing messages
    //   if (!allEqual) {
    //     console.log("[Test] Message count discrepancies:");
    //     personaArray.forEach((persona, index) => {
    //       if (messageCounts[index] !== expectedCount) {
    //         console.log(
    //           `[Test] ${persona.name}: ${messageCounts[index]} (expected ${expectedCount})`,
    //         );
    //       }
    //     });
    //   }

    //   expect(allEqual).toBe(true);
    //   expect(expectedCount).toBeGreaterThanOrEqual(messagesToSend);

    //   // Clean up
    //   for (const persona of personaArray) {
    //     await persona.worker?.terminate();
    //   }
    // });
  },
  timeoutMax,
);
