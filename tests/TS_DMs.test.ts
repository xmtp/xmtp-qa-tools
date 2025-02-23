import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let bob: Persona, joe: Persona, dmId: string, sam: Persona;

  beforeAll(async () => {
    const personas = ["bob", "joe", "sam"];
    [bob, joe, sam] = await getPersonas(
      personas,
      env,
      testName,
      personas.length,
    );
  }, defaultValues.timeout);

  it(
    "TC_CreateDM: should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(sam.address!);
      expect(typeof dmId).toBe("string");
      expect(dmId.length).toBeGreaterThan(5);
    },
    defaultValues.timeout,
  );

  // it(
  //   "TC_SendGM: should measure sending a gm",
  //   async () => {
  //     const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
  //     await bob.worker!.sendMessage(dmId!, gmMessage);
  //     console.log("[TEST] GM Message sent", gmMessage);
  //     expect(gmMessage).toBeDefined();
  //   },
  //   defaultValues.timeout,
  // );

  it(
    "TC_ReceiveGM: should measure receiving a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      const samePromise = sam.worker!.receiveMessage(dmId!, [gmMessage]);

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
