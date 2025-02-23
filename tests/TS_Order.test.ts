import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { verifyDM, type Conversation, type XmtpEnv } from "../helpers/verify";
import {
  defaultValues,
  getWorkers,
  type Persona,
} from "../helpers/workers/creator";

const env: XmtpEnv = "dev";
const amount = 5;
const testName = "TS_Order_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

/*
TODO:
- If if dont do the await, the messages are not in order, is this expected for guaranteeing order?
- If i do the await, the messages are in order both in streams and pull, what would be a real-world way to test this?
*/

describe(testName, () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    group: Conversation,
    sam: Persona;

  beforeAll(async () => {
    [bob, alice, joe, sam] = await getWorkers(
      ["bob", "alice", "joe", "sam"],
      env,
      testName,
    );
  }, defaultValues.timeout);

  it(
    "TC_StreamOrder: should verify message order when receiving via streams",
    async () => {
      group = await bob.client!.conversations.newGroup([
        joe.client?.accountAddress as `0x${string}`,
        bob.client?.accountAddress as `0x${string}`,
        alice.client?.accountAddress as `0x${string}`,
        sam.client?.accountAddress as `0x${string}`,
      ]);
      console.log("Group created", group.id);
      expect(group.id).toBeDefined();

      const randomMessage = Math.random().toString(36).substring(2, 15);
      const messages: string[] = [];
      for (let i = 0; i < amount; i++) {
        messages.push("message-" + (i + 1).toString() + "-" + randomMessage);
      }

      // Wait for Joe to see it
      const receivers = [joe, alice, sam];
      const parsedMessages = await verifyDM(
        async () => {
          // Send messages sequentially to maintain order
          for (const msg of messages) {
            await group.send(msg);
          }
        },
        receivers,
        amount,
      );

      // Group messages by receiver - each receiver should have all messages in order
      for (let i = 0; i < receivers.length; i++) {
        console.log(`Verifying messages for ${receivers[i].name}`);
        const receiverMessages = parsedMessages.slice(
          i * amount,
          (i + 1) * amount,
        );
        console.log("Expected:", messages);
        console.log("Received:", receiverMessages);
        // Assert that the messages are not in order
        expect(receiverMessages.length).toBe(amount);
        expect(receiverMessages).not.toEqual(messages);
        console.log(`${receivers[i].name} did not receive messages in order`);
      }
    },
    defaultValues.timeout * 2,
  );

  it(
    "TC_PullOrder: should verify message order when receiving via pull",
    async () => {
      console.time("createGroup");
      group = await bob.client!.conversations.newGroup([
        joe.client?.accountAddress as `0x${string}`,
        bob.client?.accountAddress as `0x${string}`,
        alice.client?.accountAddress as `0x${string}`,
        sam.client?.accountAddress as `0x${string}`,
      ]);
      console.log("Group created", group.id);
      expect(group.id).toBeDefined();
      console.timeEnd("createGroup");

      console.time("sendMessages");
      const randomMessage = Math.random().toString(36).substring(2, 15);
      const messages: string[] = [];
      for (let i = 0; i < amount; i++) {
        messages.push("message-" + (i + 1).toString() + "-" + randomMessage);
      }

      // Send messages sequentially to maintain order
      for (const msg of messages) {
        await group.send(msg);
      }
      console.timeEnd("sendMessages");

      console.time("pullMessages");
      // Pull messages for both recipients
      const conversation = alice.client!.conversations.getConversationById(
        group.id,
      );
      const aliceMessages = await conversation!.messages();
      const parsedAliceMessages = aliceMessages.map(
        (msg) => msg.content as string,
      );
      const joeConversation = joe.client!.conversations.getConversationById(
        group.id,
      );
      const joeMessages = await joeConversation!.messages();
      const parsedJoeMessages = joeMessages.map((msg) => msg.content as string);

      const samConversation = sam.client!.conversations.getConversationById(
        group.id,
      );
      const samMessages = await samConversation!.messages();
      const parsedSamMessages = samMessages.map((msg) => msg.content as string);
      console.timeEnd("pullMessages");
      // Verify the order of messages received by Alice
      expect(parsedAliceMessages).toEqual(messages);
      console.log("Alice received messages in order");

      // Verify the order of messages received by Joe
      expect(parsedJoeMessages).toEqual(messages);
      console.log("Joe received messages in order");

      // Verify the order of messages received by Sam
      expect(parsedSamMessages).toEqual(messages);
      console.log("Sam received messages in order");
    },
    defaultValues.timeout * 2,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
