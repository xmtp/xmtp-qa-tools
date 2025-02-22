import fs from "fs";
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
const testName = "TS_Personas_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

/* 
Topics:
- Inconsistent test results (~20%).
- Performance issues (>1000ms) for operations
- Old sdk to new sdk breaks (node 41 to 42)
- agent stream failures
- 20% missed streams

*/

describe(testName, () => {
  let bob: Persona, alice: Persona, joe: Persona, bobB41: Persona;
  let randomAddress: string;
  let randomAddress2: string;

  beforeAll(async () => {
    // Ensure the data folder is clean before running tests
    //fs.rmSync(".data", { recursive: true, force: true });
  }, defaultValues.timeout);

  it(
    "should create a persona",
    async () => {
      const personas = ["bob", "alice"];
      [bob, alice] = await getPersonas(
        personas,
        env,
        testName,
        personas.length,
      );
      expect(bob.dbPath).toBeDefined();
      expect(alice.dbPath).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should create 2 random personas",
    async () => {
      const { address } = await getNewRandomPersona(env);
      randomAddress = address;
      const { address: address2 } = await getNewRandomPersona(env);
      randomAddress2 = address2;

      expect(randomAddress).toBeDefined();
      expect(randomAddress2).toBeDefined();
    },
    defaultValues.timeout,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
