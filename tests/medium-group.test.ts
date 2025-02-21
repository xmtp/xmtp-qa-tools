import type { XmtpEnv } from "node-sdk-42";
import { sleep } from "openai/core.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Medium_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Complex group interactions with multiple participants", () => {
  // Define 50 participants using an array
  const participantNames = [
    "alice",
    "bob",
    "charlie",
    "dave",
    "eve",
    "frank",
    "grace",
    "henry",
    "ivy",
    "jack",
    "karen",
    "larry",
    "mary",
    "nancy",
    "oscar",
    "paul",
    "quinn",
    "rachel",
    "steve",
    "tom",
    "ursula",
    "victor",
    "wendy",
    "xavier",
    "yolanda",
    "zack",
    "adam",
    "bella",
    "carl",
    "diana",
    "eric",
    "fiona",
    "george",
    "hannah",
    "ian",
    "julia",
    "keith",
    "lisa",
    "mike",
    "nina",
    "oliver",
    "penny",
    "quentin",
    "rosa",
    "sam",
    "tina",
    "uma",
    "vince",
    "walt",
    "xena",
  ];

  let participants: Persona[] = [];
  let groupId: string;

  beforeAll(async () => {
    // Get all personas at once
    participants = await getPersonas(participantNames, env, testName);
  }, defaultValues.timeout);

  it(
    "should create a group and handle multiple messages with many participants",
    async () => {
      const creator = participants[0]; // First participant creates the group
      const addresses = participants.map((p) => p.address!);

      // Create group with all participants
      groupId = await creator.worker!.createGroup(addresses);

      // Function to get random recipients (5-10 participants)
      const getRandomRecipients = () => {
        return participants
          .slice(1) // Exclude creator
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(Math.random() * 6) + 5);
      };

      const message = `gm-${Math.random().toString(36).substring(2, 8)}`;
      const recipients = getRandomRecipients();
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
      expect(receivedMessages.length).toBe(recipients.length);
      expect(receivedMessages).toContain(message);

      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);

      //Update group name randomly by one participant
      const randomParticipant =
        participants[Math.floor(Math.random() * participants.length)];
      await randomParticipant.worker!.updateGroupName(groupId, newGroupName);

      // Add debug logs
      console.log("[TEST] Actual received messages:", receivedMessages.length);
      console.log("[TEST] Expected messages length:", recipients.length);
      console.log("[TEST] Expected me ssage:", message);
      console.log("[TEST] Expected group name:", newGroupName);
    },
    defaultValues.timeout,
  ); // Double timeout for complex test

  afterAll(() => {
    flushLogger(testName);
  });
});
