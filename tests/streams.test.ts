import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPersonas, type Persona } from "../helpers/personas";

// Adjust path

const timeout = 20000;
describe("Performance test for sending gm (Bob -> Joe)", () => {
  let bob: Persona;
  let joe: Persona;
  let elon: Persona;
  let alice: Persona;
  let fabri: Persona;

  beforeAll(async () => {
    [bob, joe, elon, fabri, alice] = await getPersonas(
      ["bob", "joe", "elon", "fabri", "alice"],
      "dev",
    );
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, timeout);

  it(
    "test bob sending gm to joe",
    async () => {
      const result = await testMessageTo(bob, joe);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test joe sending gm to bob",
    async () => {
      const result = await testMessageTo(joe, bob);
      expect(result).toBe(true);
    },
    timeout,
  ); // Increase timeout if needed

  it(
    "test alice sending gm to fabri",
    async () => {
      const result = await testMessageTo(alice, fabri);
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
});

async function testMessageTo(sender: Persona, receiver: Persona) {
  try {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    // Joe sets up a promise to wait for that exact message
    const messagePromise = receiver.worker.receiveMessage(message);

    console.log(
      `[${sender.name}] Creating DM with ${receiver.name} at ${receiver.client.accountAddress}`,
    );

    const dmConvo = await sender.client.conversations.newDm(
      receiver.client.accountAddress,
    );
    await dmConvo.send(message);

    // Wait for Joe to see it
    const receivedMessage = await messagePromise;
    expect(receivedMessage.data.content).toBe(message);
    console.log(
      `[${receiver.name}] Message received:`,
      receivedMessage.data.content,
    );

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
