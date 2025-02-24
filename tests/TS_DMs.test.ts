import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { verifyDMs } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/creator";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;

describe(testName, () => {
  let bob: Persona;
  let joe: Persona;
  let sam: Persona;
  let convo: Conversation;
  let personas: Persona[];

  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);

    personas = await getWorkers(["bob", "joe", "sam"], env, testName);
    [bob, joe, sam] = personas;
    console.log("bob", bob.client?.accountAddress);
    console.log("joe", joe.client?.accountAddress);
    console.log("sam", sam.client?.accountAddress);
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      personas.map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateDM: should measure creating a DM", async () => {
    convo = await bob.client!.conversations.newDm(sam.client!.accountAddress);
    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("TC_SendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${bob.name}] Creating DM with ${sam.name} at ${sam.client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("TC_ReceiveGM: should measure receiving a gm", async () => {
    const result = await verifyDMs(convo, [sam]);

    expect(result).toBe(true);
  });
});
