import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getPersonas,
  getRandomPersonas,
  participantNames,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Small_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Small group interactions with multiple participants", () => {
  // Define 50 participants using an array

  let participants: Persona[] = [];
  let groupId: string;

  beforeAll(async () => {
    // Get all personas at once
    participants = await getPersonas(participantNames, env, testName, 10);
  }, defaultValues.timeout);

  it(
    "should create a group and handle multiple messages with many participants",
    async () => {
      const creator = participants[0]; // First participant creates the group
      const addresses = participants.map((p) => p.address!);

      // Create group with all participants
      groupId = await creator.worker!.createGroup(addresses);

      const message = `gm-${Math.random().toString(36).substring(2, 8)}`;
      const recipients = getRandomPersonas(participants, 10);
      console.log("[TEST] Recipients:", recipients.length);
      // Set up message reception streams
      const receivePromises = recipients.map(
        async (recipient) =>
          await recipient.worker!.receiveMessage(groupId, message),
      );

      // Send messages
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await creator.worker!.sendMessage(groupId, message);

      // Verify reception
      const receivedMessages = await Promise.all(receivePromises);
      const validMessages = receivedMessages.filter((msg) => msg !== null);
      console.log("[TEST] Valid messages received:", validMessages.length);

      // Expect at least some messages to be received (adjust percentage as needed)
      expect(validMessages.length).toBeGreaterThan(0);
      validMessages.forEach((msg) => {
        expect(msg).toBe(message);
      });

      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);

      //for 3 random participants receivemetadata
      const randomParticipants = getRandomPersonas(participants, 3);
      const metadataPromises = randomParticipants.map((p) =>
        p.worker!.receiveMetadata(groupId, newGroupName),
      );
      //Update group name randomly by one participant
      const randomParticipant = getRandomPersonas(participants, 1)[0];
      await randomParticipant.worker!.updateGroupName(groupId, newGroupName);

      await new Promise((resolve) => setTimeout(resolve, 4000));
      const metadataReceived = await Promise.all(metadataPromises);

      // Add debug logs
      console.log("[TEST] Actual messages received:", receivedMessages.length);
      console.log("[TEST] Expected messages length:", recipients.length);
      console.log("[TEST] Group updates received:", metadataReceived.length);
      console.log("[TEST] Expected group name:", metadataReceived);
      expect(receivedMessages.length).toBe(recipients.length);
      expect(receivedMessages).toContain(message);
      expect(metadataReceived.length).toBe(randomParticipants.length);
      expect(metadataReceived).toContain(newGroupName);
    },
    defaultValues.timeout * 2,
  ); // Double timeout for complex test

  afterAll(() => {
    flushLogger(testName);
  });
});
