import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";
import { verifyDM } from "../helpers/xmtp";

/* 
  TODO:
- Streams
    - Ensure streams recover correctly.
    - Handling repeated dual streams.
    - Stream metadata.
    - Test different type of streams for users.
    - Timeout?
    - Parallel streams.
    - Installations
      - Multiple installations.
      - Multiple clients from the same installation.
*/

const env = "dev";
const timeout = defaultValues.timeout;
const testName = "TS_Streams_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let bob: Persona;
  let joe: Persona;
  let elon: Persona;
  let alice: Persona;
  let fabri: Persona;

  beforeAll(async () => {
    [bob, joe, elon, fabri, alice] = await getPersonas(
      ["bob", "joe", "elon", "fabri", "alice"],
      "dev",
      testName,
    );
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, timeout * 2);

  afterAll(async () => {
    await Promise.all(
      [bob, joe, elon, fabri, alice].map((persona) =>
        persona.worker?.terminate(),
      ),
    );
  });

  it(
    "test fabri sending gm to alice",
    async () => {
      const result = await verifyDM(fabri, alice);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test fabri sending gm to alice",
    async () => {
      const result = await verifyDM(fabri, alice);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test elon sending gm to fabri",
    async () => {
      const result = await verifyDM(elon, fabri);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test bob sending gm to joe",
    async () => {
      const result = await verifyDM(bob, joe);
      expect(result).toBe(true);
    },
    timeout,
  );
});
