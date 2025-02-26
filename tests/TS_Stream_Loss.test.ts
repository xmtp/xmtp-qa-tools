import path from "path";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();

const testName = "TS_Stream_Loss";
const env: XmtpEnv = "dev";

const amountofMessages = 10; // Number of messages to collect per receiver
const receivers = 50;
// 2 seconds per message, multiplied by the total number of participants
const timeoutMax =
  amountofMessages * receivers * defaultValues.perMessageTimeout;

/*eslint-disable*/
if (receivers < 2) {
  throw new Error("Receivers must be at least 2");
}
/*eslint-enable*/
describe(
  "TS_Stream_Loss: should verify message loss when receiving via streams",
  () => {
    let personas: Record<string, Persona>;

    // We'll define these so they're accessible in the test
    let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
    let gmSender: (convo: Conversation, message: string) => Promise<void>;

    // 1. Setup
    beforeAll(async () => {
      const logger = await createLogger(testName);
      overrideConsole(logger);

      // Use getWorkers to spin up many personas. This is resource-intensive.
      personas = await getWorkers(receivers, env, testName);
    });

    // 2. Teardown
    afterAll(async () => {
      await flushLogger(testName);

      // Terminate each worker thread
      await Promise.all(
        Object.values(personas).map(async (persona) => {
          await persona.worker?.terminate();
        }),
      );
    });

    it("TS_Stream_Loss: should verify message order when receiving via streams", async () => {
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

      gmMessageGenerator = async (i: number, suffix: string) => {
        return `gm-${i + 1}-${suffix}`;
      };

      gmSender = async (convo: Conversation, message: string) => {
        console.time("[Test] Message send time");
        await convo.send(message);
        console.timeEnd("[Test] Message send time");
      };

      // Verify that each receiver collects `amount` messages of type "text".
      console.log("[Test] Starting message verification");
      console.time("[Test] Verification time");
      const collectedMessages = await verifyStream(
        group,
        Object.values(personas),
        gmMessageGenerator,
        gmSender,
        "text",
        amountofMessages,
      );
      console.timeEnd("[Test] Verification time");

      // Evaluate how many messages were received in total
      const totalMessages = amountofMessages * (receivers - 1);
      const receivedMessagesCount = collectedMessages.messages.flat().length;
      const percentageReceived = (receivedMessagesCount / totalMessages) * 100;

      console.log(
        `[Test] Total messages expected: ${totalMessages}, received: ${receivedMessagesCount}`,
      );
      console.log(
        `[Test] Percentage of messages received: ${percentageReceived}%`,
      );

      // We expect at least 99% to pass
      expect(percentageReceived).toBeGreaterThanOrEqual(99);
    });
  },
  timeoutMax,
);
