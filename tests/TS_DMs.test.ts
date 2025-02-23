import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  PersonaFactory,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let bob: Persona, joe: Persona, dmId: string, sam: Persona;

  beforeAll(async () => {
    const personaFactory = new PersonaFactory(env, testName);
    [bob, joe, sam] = await personaFactory.getPersonas(["bob", "joe", "sam"]);
    console.log("bob", bob.address);
    console.log("joe", joe.address);
    console.log("sam", sam.address);
  }, defaultValues.timeout);

  it(
    "TC_CreateDM: should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(sam.address);
      expect(typeof dmId).toBe("string");
      expect(dmId.length).toBeGreaterThan(5);
    },
    defaultValues.timeout,
  );

  it(
    "TC_SendGM: should measure sending a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      await bob.worker!.sendMessage(dmId, gmMessage);
      console.log("[TEST] GM Message sent", gmMessage);
      expect(gmMessage).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGM: should measure receiving a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      const samePromise = sam.worker!.receiveMessage(gmMessage);

      await bob.worker!.sendMessage(dmId!, gmMessage);
      const received = await samePromise;
      expect(received).toContain(gmMessage);
    },
    defaultValues.timeout,
  );
  afterAll(async () => {
    flushLogger(testName);
  });
});
