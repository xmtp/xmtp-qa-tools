import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";
import { verifyDM } from "../helpers/xmtp";

/* 
TODO:
- Streams
  Percentge of missed?
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

describe(testName, () => {
  let bob: Persona;
  let joe: Persona;
  let elon: Persona;
  let alice: Persona;
  let fabri: Persona;
  let personas: Persona[];
  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);
    personas = await getPersonas(
      ["bob", "joe", "elon", "fabri", "alice"],
      "dev",
      testName,
    );
    [bob, joe, elon, fabri, alice] = personas;
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, timeout * 2);

  afterAll(async () => {
    flushLogger(testName);
    await Promise.all(
      personas.map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it(
    "test fabri sending gm to alice",
    async () => {
      const dmConvo = await fabri.client?.conversations.newDm(
        alice.client?.accountAddress as `0x${string}`,
      );
      if (!dmConvo) {
        throw new Error("DM conversation not found");
      }
      const message = "gm-" + Math.random().toString(36).substring(2, 15);
      const parsedMessages = await verifyDM(
        () => dmConvo.send(message),
        [alice],
      );
      expect(parsedMessages).toEqual([message]);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test fabri sending gm to alice",
    async () => {
      const dmConvo = await fabri.client?.conversations.newDm(
        alice.client?.accountAddress as `0x${string}`,
      );
      if (!dmConvo) {
        throw new Error("DM conversation not found");
      }
      const message = "gm-" + Math.random().toString(36).substring(2, 15);
      const parsedMessages = await verifyDM(
        () => dmConvo.send(message),
        [alice],
      );
      expect(parsedMessages).toEqual([message]);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test elon sending gm to fabri",
    async () => {
      const message = "gm-" + Math.random().toString(36).substring(2, 15);
      const dmConvo = await elon.client?.conversations.newDm(
        fabri.client?.accountAddress as `0x${string}`,
      );
      if (!dmConvo) {
        throw new Error("DM conversation not found");
      }
      const parsedMessages = await verifyDM(
        () => dmConvo.send(message),
        [fabri],
      );
      expect(parsedMessages).toEqual([message]);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test bob sending gm to joe",
    async () => {
      const message = "gm-" + Math.random().toString(36).substring(2, 15);
      const dmConvo = await bob.client?.conversations.newDm(
        joe.client?.accountAddress as `0x${string}`,
      );
      if (!dmConvo) {
        throw new Error("DM conversation not found");
      }
      const parsedMessages = await verifyDM(() => dmConvo.send(message), [joe]);
      expect(parsedMessages).toEqual([message]);
    },
    timeout,
  );

  afterAll(async () => {
    flushLogger(testName);
  });
});
