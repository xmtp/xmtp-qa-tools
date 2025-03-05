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

const amountofMessages = 100; // Number of messages to collect per receiver
const receivers = 40;
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
  },
  timeoutMax,
);
