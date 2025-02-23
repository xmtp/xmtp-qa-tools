import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Consent_" + env;
const logger = createLogger(testName);
overrideConsole(logger);
describe(testName, () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    dmId: string,
    randomAddress: string,
    sam: Persona,
    jack: Persona;

  beforeAll(async () => {
    const personas = ["bob", "alice", "joe", "bobB41", "sam", "jack"];
    [bob, alice, joe, bobB41, sam, jack] = await getPersonas(
      personas,
      env,
      testName,
      personas.length,
    );
    const { address } = await getNewRandomPersona(env);
    randomAddress = address;
  }, defaultValues.timeout);

  it(
    "TC_Consent: should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(jack.address!);
      expect(typeof dmId).toBe("string");
      expect(dmId.length).toBeGreaterThan(5);
    },
    defaultValues.timeout,
  );

  afterAll(async () => {
    flushLogger(testName);
  });
});
