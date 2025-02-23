import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  DefaultPersonas,
  defaultValues,
  PersonaFactory,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Personas_" + env;
const logger = createLogger(testName);
const personaFactory = new PersonaFactory(env, testName);
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
  beforeAll(async () => {
    // Ensure the data folder is clean before running tests
    //fs.rmSync(".data", { recursive: true, force: true });
  }, defaultValues.timeout);

  it(
    "should create a persona",
    async () => {
      // Get Bob's persona using the enum value.
      const [bob] = await personaFactory.getPersonas([DefaultPersonas.BOB]);

      expect(bob.address).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should create a random persona",
    async () => {
      const [randomPersona] = await personaFactory.getPersonas(["random"]);
      expect(randomPersona.address).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should create multiple personas",
    async () => {
      const personas = await personaFactory.getPersonas([
        DefaultPersonas.BOB,
        DefaultPersonas.ALICE,
        "randompep",
        "randombob",
      ]);
      const [bob, alice, random, randomBob] = personas;
      expect(bob.address).toBeDefined();
      expect(alice.address).toBeDefined();
      expect(random.address).toBeDefined();
      expect(randomBob.address).toBeDefined();
    },
    defaultValues.timeout * 2,
  );

  // it(
  //   "should create 10 personas",
  //   async () => {
  //     const selectedPersonas = [
  //       DefaultPersonas.BOB,
  //       DefaultPersonas.ALICE,
  //       DefaultPersonas.ADAM,
  //       DefaultPersonas.BELLA,
  //       DefaultPersonas.CARL,
  //       DefaultPersonas.DIANA,
  //       DefaultPersonas.ERIC,
  //       DefaultPersonas.FIONA,
  //       DefaultPersonas.GEORGE,
  //       DefaultPersonas.HANNAH,
  //     ];
  //     const personas = await personaFactory.getPersonas(selectedPersonas);

  //     for (const persona of personas) {
  //       expect(persona.address).toBeDefined();
  //     }
  //   },
  //   defaultValues.timeout * 4,
  // );
  afterAll(() => {
    flushLogger(testName);
  });
});
