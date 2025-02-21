import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Performance_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Performance test for sending gm, creating group, and sending gm in group", () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    dmId: string,
    groupId: string,
    randomAddress: string,
    sam: Persona;

  beforeAll(async () => {
    const personas = ["bob", "alice", "joe", "bobB41", "sam"];
    [bob, alice, joe, bobB41, sam] = await getPersonas(
      personas,
      env,
      testName,
      personas.length,
    );
    const { address } = await getNewRandomPersona(env);
    randomAddress = address;
  }, defaultValues.timeout);

  it(
    "TC_CreateDM: should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(randomAddress);
      console.log("[TEST] DM ID", dmId);
      expect(dmId).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_SendGM: should measure sending a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      await bob.worker!.sendMessage(dmId!, gmMessage);
      console.log("[TEST] GM Message sent", gmMessage);
      expect(gmMessage).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGM: should measure receiving a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      dmId = await bob.worker!.createDM(joe.address!);
      const joePromise = joe.worker!.receiveMessage(dmId!, gmMessage);

      await bob.worker!.sendMessage(dmId!, gmMessage);
      const received = await joePromise;
      console.log("[TEST] GM Message received", received);
      expect(received).toBe(gmMessage);
    },
    defaultValues.timeout,
  );
  afterAll(() => {
    flushLogger(testName);
  });
});
