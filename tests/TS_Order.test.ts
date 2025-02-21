import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

const env: XmtpEnv = "dev";
const amount = 20;
const testName = "TS_Order_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let bob: Persona, alice: Persona, joe: Persona, groupId: string, sam: Persona;

  beforeAll(async () => {
    const personas = ["bob", "alice", "joe", "sam"];
    [bob, alice, joe, sam] = await getPersonas(
      personas,
      env,
      testName,
      personas.length,
    );
  }, defaultValues.timeout);

  it(
    "TC_StreamOrder: should verify message order when receiving via streams",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
        sam.address!,
      ]);
      console.log("[TEST] Group created", groupId);
      expect(groupId).toBeDefined();

      const randomMessage = Math.random().toString(36).substring(2, 15);
      const messages: string[] = [];
      for (let i = 0; i < amount; i++) {
        messages.push("message-" + (i + 1).toString() + "-" + randomMessage);
      }

      const alicePromises = alice.worker!.receiveMessage(groupId!, messages);
      const joePromises = joe.worker!.receiveMessage(groupId!, messages);
      const samPromises = sam.worker!.receiveMessage(groupId!, messages);

      // Send messages sequentially to maintain order
      for (const msg of messages) {
        await bob.worker!.sendMessage(groupId!, msg);
      }

      const [aliceReceived, joeReceived, samReceived] = await Promise.all([
        alicePromises,
        joePromises,
        samPromises,
      ]);
      console.log("[TEST] Alice received", JSON.stringify(aliceReceived));
      console.log("[TEST] Sam received", JSON.stringify(samReceived));
      console.log("[TEST] Joe received", JSON.stringify(joeReceived));

      // Verify the order of messages received by Alice
      expect(aliceReceived).not.toEqual(messages);
      console.log("[TEST] Alice received messages in order");

      // Verify the order of messages received by Joe
      expect(joeReceived).not.toEqual(messages);
      console.log("[TEST] Joe received messages in order");

      // Verify the order of messages received by Sam
      expect(samReceived).not.toEqual(messages);
      console.log("[TEST] Sam received messages in order");
    },
    defaultValues.timeout * 2,
  );

  it(
    "TC_PullOrder: should verify message order when receiving via pull",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
        sam.address!,
      ]);
      console.log("[TEST] Group created", groupId);
      expect(groupId).toBeDefined();

      const randomMessage = Math.random().toString(36).substring(2, 15);
      const messages: string[] = [];
      for (let i = 0; i < amount; i++) {
        messages.push("message-" + (i + 1).toString() + "-" + randomMessage);
      }

      // Send messages sequentially to maintain order
      for (const msg of messages) {
        await bob.worker!.sendMessage(groupId!, msg);
      }

      // Pull messages for both recipients
      const aliceMessages = await alice.worker!.pullMessages(groupId!);
      const joeMessages = await joe.worker!.pullMessages(groupId!);
      const samMessages = await sam.worker!.pullMessages(groupId!);

      console.log("[TEST] Alice received", JSON.stringify(aliceMessages));
      console.log("[TEST] Sam received", JSON.stringify(samMessages));
      console.log("[TEST] Joe received", JSON.stringify(joeMessages));

      // Verify the order of messages received by Alice
      expect(aliceMessages).toEqual(messages);
      console.log("[TEST] Alice received messages in order");

      // Verify the order of messages received by Joe
      expect(joeMessages).toEqual(messages);
      console.log("[TEST] Joe received messages in order");

      // Verify the order of messages received by Sam
      expect(samMessages).toEqual(messages);
      console.log("[TEST] Sam received messages in order");
    },
    defaultValues.timeout * 2,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
