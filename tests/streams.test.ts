import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

// Adjust pathconst

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
      const result = await testMessageTo(fabri, alice);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test fabri sending gm to alice",
    async () => {
      const result = await testMessageTo(fabri, alice);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test elon sending gm to fabri",
    async () => {
      const result = await testMessageTo(elon, fabri);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test bob sending gm to joe",
    async () => {
      const result = await testMessageTo(bob, joe);
      expect(result).toBe(true);
    },
    timeout,
  );
});

async function testMessageTo(sender: Persona, receiver: Persona) {
  try {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    // Joe sets up a promise to wait for that exact message
    const messagePromise = receiver.worker?.receiveMessage(message);

    console.log(
      `[${sender.name}] Creating DM with ${receiver.name} at ${receiver.client?.accountAddress}`,
    );

    const dmConvo = await sender.client?.conversations.newDm(
      receiver.client?.accountAddress as `0x${string}`,
    );
    const dmId = await dmConvo?.send(message);
    console.log("dmId", dmId);

    // Wait for Joe to see it
    const receivedMessage = await messagePromise;
    expect(receivedMessage?.data.content).toBe(message);
    console.log(
      `[${receiver.name}] Message received:`,
      receivedMessage?.data.content,
    );

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
