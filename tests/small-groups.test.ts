import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Complex group interactions with multiple participants", () => {
  let alice: Persona,
    bob: Persona,
    charlie: Persona,
    dave: Persona,
    eve: Persona,
    joe: Persona,
    pepe: Persona;

  let groupId: string;

  beforeAll(async () => {
    [alice, bob, joe, charlie, dave, eve, pepe] = await getPersonas(
      ["alice", "bob", "joe", "charlie", "dave", "eve", "pepe"],
      env,
      testName,
    );
  }, defaultValues.timeout);

  it(
    "should create a group and handle multiple messages and metadata updates",
    async () => {
      // Create group with all participants
      groupId = await alice.worker!.createGroup([
        alice.address!,
        bob.address!,
        joe.address!,
        charlie.address!,
        dave.address!,
        eve.address!,
      ]);

      // Function to get random recipients (2-4 participants)
      const getRandomRecipients = () => {
        const participants = [bob, charlie, dave, eve];
        return participants
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(Math.random() * 3) + 2);
      };

      const message = `gm-${Math.random().toString(36).substring(2, 8)}`;
      const recipients = getRandomRecipients();

      // Set up message reception streams
      const receivePromises = recipients.map((recipient) =>
        recipient.worker!.receiveMessage(groupId, message),
      );

      // Send message
      await alice.worker!.sendMessage(groupId, message);

      // Verify reception
      const receivedMessages = await Promise.all(receivePromises);

      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);

      const joePromise = joe.worker!.receiveMetadata(groupId!, newGroupName);
      await bob.worker!.updateGroupName(groupId, newGroupName);
      const joeReceived = await joePromise;

      // Add debug logs
      console.log("[TEST] Expected messages length:", recipients.length);
      console.log("[TEST] Actual received messages:", receivedMessages);
      console.log("[TEST] Expected message:", message);
      console.log("[TEST] Expected group name:", newGroupName);
      console.log("[TEST] Actual received group name:", joeReceived);

      expect(receivedMessages.length).toBe(recipients.length);
      expect(receivedMessages).toContain(message);
      expect(joeReceived).toBe(newGroupName);
    },
    defaultValues.timeout * 2,
  ); // Double timeout for complex test

  afterAll(() => {
    flushLogger(testName);
  });
});
