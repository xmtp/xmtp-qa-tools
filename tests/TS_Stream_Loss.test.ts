import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  WorkerNames,
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

const amount = 2; // Number of messages to collect per receiver
const testName = "TS_Stream_Loss";
const env: XmtpEnv = "dev";

// 2 seconds per message, multiplied by the total number of participants
let timeoutMax = amount * defaultValues.perMessageTimeout;

describe("TC_StreamLoss: should verify message loss when receiving via streams", () => {
  let personas: Record<string, Persona>;

  // We'll define these so they're accessible in the test
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  // 1. Setup
  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);

    // Use getWorkers to spin up many personas. This is resource-intensive.
    personas = await getWorkers(
      [
        // Large list of user descriptors. Each will become one Worker.
        WorkerNames.BOB,
        WorkerNames.ALICE,
        WorkerNames.JOE,
        WorkerNames.SAM,
        WorkerNames.CHARLIE,
        WorkerNames.DAVE,
        WorkerNames.EVE,
        WorkerNames.FRANK,
        WorkerNames.GRACE,
        WorkerNames.HENRY,
        WorkerNames.IVY,
        WorkerNames.JACK,
        WorkerNames.KAREN,
        WorkerNames.LARRY,
        WorkerNames.MARY,
        WorkerNames.NANCY,
        WorkerNames.OSCAR,
        WorkerNames.PAUL,
        WorkerNames.QUINN,
        WorkerNames.RACHEL,
        WorkerNames.STEVE,
        WorkerNames.TOM,
        WorkerNames.URSULA,
        WorkerNames.VICTOR,
        WorkerNames.WENDY,
        WorkerNames.XAVIER,
        WorkerNames.YOLANDA,
        WorkerNames.ZACK,
        WorkerNames.GUADA,
        WorkerNames.ADAM,
        WorkerNames.BELLA,
        WorkerNames.CARL,
        WorkerNames.DIANA,
        WorkerNames.ERIC,
        WorkerNames.FIONA,
        WorkerNames.GEORGE,
        WorkerNames.HANNAH,
        WorkerNames.IAN,
        WorkerNames.JULIA,
        WorkerNames.KEITH,
        WorkerNames.LISA,
        WorkerNames.MIKE,
        WorkerNames.NINA,
        WorkerNames.OLIVER,
        WorkerNames.PENNY,
        WorkerNames.QUENTIN,
        WorkerNames.ROSALIE,
      ],
      env,
      testName,
    );

    // Increase timeout based on how many personas we have
    timeoutMax = timeoutMax * Object.keys(personas).length;
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

  it(
    "TC_StreamOrder: should verify message order when receiving via streams",
    async () => {
      // Create a new group conversation with Bob (creator) and all others.
      const group = await personas["bob"].client!.conversations.newGroup(
        Object.values(personas).map(
          (p) => p.client?.accountAddress as `0x${string}`,
        ),
      );
      console.log("[Test] Created group:", group.id);
      expect(group.id).toBeDefined();

      // We exclude Bob from receiving; Bob is the group creator.
      const receivers = Object.values(personas).filter(
        (p) =>
          p.client?.accountAddress !==
          personas[WorkerNames.BOB].client?.accountAddress,
      );

      gmMessageGenerator = async (i: number, suffix: string) => {
        return `gm-${i + 1}-${suffix}`;
      };

      gmSender = async (convo: Conversation, message: string) => {
        await convo.send(message);
      };

      // Verify that each receiver collects `amount` messages of type "text".
      const collectedMessages = await verifyStream(
        group,
        receivers,
        gmMessageGenerator,
        gmSender,
        "text",
        amount,
      );

      // Evaluate how many messages were received in total
      const totalMessages = amount * receivers.length;
      const receivedMessagesCount = collectedMessages.messages.flat().length;
      const percentageReceived = (receivedMessagesCount / totalMessages) * 100;

      console.log(
        `[Test] Percentage of messages received: ${percentageReceived}%`,
      );

      // We expect at least 99% to pass
      expect(percentageReceived).toBeGreaterThanOrEqual(99);
    },
    timeoutMax,
  );
});
