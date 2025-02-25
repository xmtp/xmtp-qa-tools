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

const amount = 200; // Number of messages to collect per receiver
const testName = "TS_Stream_Loss";
const env: XmtpEnv = "dev";
let timeoutMax = amount * defaultValues.perMessageTimeout; // 2 seconds per message
describe("TC_StreamLoss: should verify message loss when receiving via streams", () => {
  let personas: Record<string, Persona>;

  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);

    personas = await getWorkers(
      [
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
    timeoutMax = timeoutMax * Object.keys(personas).length;
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it(
    "TC_StreamOrder: should verify message order when receiving via streams",
    async () => {
      // Create a new group conversation with Bob (creator), Joe, Alice, Charlie, Dan, Eva, Frank, Grace, Henry, Ivy, and Sam.
      const group = await personas["bob"].client!.conversations.newGroup(
        Object.values(personas).map(
          (p) => p.client?.accountAddress as `0x${string}`,
        ),
      );
      console.log("Group created", group.id);
      expect(group.id).toBeDefined();

      // Define receivers (excluding Bob, the creator).
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

      // Collect messages by setting up listeners before sending and then sending known messages.
      // Use type assertion when calling verifyStream
      const collectedMessages = await verifyStream(
        group,
        receivers,
        gmMessageGenerator,
        gmSender,
        "text",
        amount,
      );

      const totalMessages = amount * receivers.length;
      const receivedMessagesCount = collectedMessages.messages.flat().length;
      const percentageReceived = (receivedMessagesCount / totalMessages) * 100;

      console.log(
        "Percentage of messages received:" +
          percentageReceived.toString() +
          "%",
      );
      expect(percentageReceived).toBeGreaterThanOrEqual(99);
    },
    timeoutMax,
  );
});
