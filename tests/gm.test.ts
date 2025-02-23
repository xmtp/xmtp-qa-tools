import type { XmtpEnv } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

const timeout = 6000;
const env: XmtpEnv = "production";

describe("Performance test for sending gm, creating group, and sending gm in group", () => {
  let bob: Persona, alice: Persona, joe: Persona, fabri: Persona, elon: Persona;

  beforeAll(async () => {
    [bob, alice, joe, fabri, elon] = await getPersonas(
      ["bob", "alice", "joe", "fabri", "elon"],
      env,
    );
    console.log("bob.worker", bob.worker?.name);
    console.log("alice.worker", alice.worker?.name);
    console.log("joe.worker", joe.worker?.name);
    console.log("fabri.worker", fabri.worker?.name);
    console.log("elon.worker", elon.worker?.name);
  }, timeout);

  it(
    "test bob with joe",
    async () => {
      const result = await testMessageFromTo(bob, joe);
      expect(result).toBe(true);
    },
    defaultValues.timeout,
  );
  it(
    "test joe to bob",
    async () => {
      const result = await testMessageFromTo(joe, bob);
      expect(result).toBe(true);
    },
    timeout,
  );
  it(
    "test joe to alice",
    async () => {
      const result = await testMessageFromTo(joe, alice);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test fabri to bob",
    async () => {
      const result = await testMessageFromTo(fabri, bob);
      expect(result).toBe(true);
    },
    timeout,
  );
  it(
    "test elon to bob",
    async () => {
      const result = await testMessageFromTo(elon, bob);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test fabri to elon",
    async () => {
      const result = await testMessageFromTo(fabri, elon);
      expect(result).toBe(true);
    },
    timeout,
  );

  // Adding remaining combinations
  it(
    "test alice to bob",
    async () => {
      const result = await testMessageFromTo(alice, bob);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test alice to joe",
    async () => {
      const result = await testMessageFromTo(alice, joe);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test alice to fabri",
    async () => {
      const result = await testMessageFromTo(alice, fabri);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test alice to elon",
    async () => {
      const result = await testMessageFromTo(alice, elon);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test bob to alice",
    async () => {
      const result = await testMessageFromTo(bob, alice);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test bob to fabri",
    async () => {
      const result = await testMessageFromTo(bob, fabri);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test bob to elon",
    async () => {
      const result = await testMessageFromTo(bob, elon);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test joe to fabri",
    async () => {
      const result = await testMessageFromTo(joe, fabri);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test joe to elon",
    async () => {
      const result = await testMessageFromTo(joe, elon);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test elon to alice",
    async () => {
      const result = await testMessageFromTo(elon, alice);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test elon to joe",
    async () => {
      const result = await testMessageFromTo(elon, joe);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test elon to fabri",
    async () => {
      const result = await testMessageFromTo(elon, fabri);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test fabri to alice",
    async () => {
      const result = await testMessageFromTo(fabri, alice);
      expect(result).toBe(true);
    },
    timeout,
  );

  it(
    "test fabri to joe",
    async () => {
      const result = await testMessageFromTo(fabri, joe);
      expect(result).toBe(true);
    },
    timeout,
  );
});

async function testMessageFromTo(sender: Persona, receiver: Persona) {
  const groupId = await sender.worker!.createDM(receiver.address!);
  console.log("groupId", groupId);

  const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  const receiverPromise = receiver.worker!.receiveMessage(groupMessage);

  await sender.worker!.sendMessage(groupId, groupMessage);
  const message = await receiverPromise;
  return message === groupMessage;
}
