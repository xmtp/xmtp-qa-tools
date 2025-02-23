import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, PersonaFactory } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Client_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

const personaFactory = new PersonaFactory(env, testName);
/* 
Topics:
- Takes 3 seconds to create a client, is this expected?
*/

describe(testName, () => {
  it(
    "TC_CreateClient: Initialize the client",
    async () => {
      const [alice, randompep] = await personaFactory.getPersonas([
        "alice",
        "randompep",
      ]);
      expect(alice.address).toBeDefined();
      expect(randompep.address).toBeDefined();
    },
    defaultValues.timeout,
  );

  afterAll(async () => {
    flushLogger(testName);
  });
});
