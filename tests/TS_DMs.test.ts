import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);

    personas = await getWorkers(["bob", "joe", "sam"], env, testName);
    console.log("bob", personas["bob"].client?.accountAddress);
    console.log("joe", personas["joe"].client?.accountAddress);
    console.log("sam", personas["sam"].client?.accountAddress);
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        console.log("terminating", persona);
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateDM: should measure creating a DM", async () => {
    convo = await personas["bob"].client!.conversations.newDm(
      personas["sam"].client!.accountAddress,
    );
    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("TC_SendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas["bob"].name}] Creating DM with ${personas["sam"].name} at ${personas["sam"].client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("TC_ReceiveGM: should measure receiving a gm", async () => {
    const gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };

    const gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };

    const verifyResult = await verifyStream(
      convo,
      [personas["sam"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.messages.length).toEqual(1);
    expect(verifyResult.allReceived).toBe(true);
  });
});
