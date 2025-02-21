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
  let participants: Persona[] = [];
  let groupId: string;
  let creator: Persona;

  beforeAll(async () => {
    // Get all personas at once
    participants = await getPersonas(participantNames, env, testName, 10);
    creator = participants[0];

    // Create the group that will be used across all tests
    console.log(
      "[TEST] Creating group with participants:",
      participants.length,
    );
    const addresses = participants.map((p) => p.address!);
    groupId = await creator.worker!.createGroup(addresses);

    // Verify initial group creation
    const { validMessages, receivedMessages } = await verifyStreams(
      creator,
      participants,
      groupId,
      9,
    );
    expect(validMessages.length).toBe(9);
    expect(receivedMessages).toBeDefined();
  }, defaultValues.timeout);

  it(
    "should handle group name updates",
    async () => {
      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);
      const randomParticipants = getRandomPersonas(participants, 3);
      const metadataPromises = randomParticipants.map((p) =>
        p.worker!.receiveMetadata(groupId, newGroupName),
      );

      const newRandomParticipant = getRandomPersonas(participants, 1)[0];
      await newRandomParticipant.worker!.updateGroupName(groupId, newGroupName);

      const metadataReceived = await Promise.all(metadataPromises);
      expect(metadataReceived.length).toBe(randomParticipants.length);
      expect(metadataReceived).toContain(newGroupName);

      // Final verification step
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        3,
      );
      expect(validMessages.length).toBe(3);
      expect(receivedMessages).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should handle adding new members",
    async () => {
      await verifyMembersCount(participants, groupId, participants.length);

      const newRandomParticipant = getRandomPersonas(participants, 1)[0];
      const membersAfterAdd = await creator.worker!.addMembers(groupId, [
        newRandomParticipant.address!,
      ]);
      console.log("[TEST] Members after adding:", membersAfterAdd);

      await verifyMembersCount(participants, groupId, 2);

      // Final verification step
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        5,
      );
      expect(validMessages.length).toBe(5);
      expect(receivedMessages).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should handle removing members",
    async () => {
      const newRandomParticipant = getRandomPersonas(participants, 1)[0];
      await verifyMembersCount(participants, groupId, 2);

      await creator.worker!.removeMembers(groupId, [
        newRandomParticipant.address!,
      ]);

      await verifyMembersCount(participants, groupId, 4);

      // Final verification step
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        5,
      );
      expect(validMessages.length).toBe(5);
      expect(receivedMessages).toBeDefined();
    },
    defaultValues.timeout,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});

async function verifyMembersCount(
  participants: Persona[],
  groupId: string,
  checkersCount: number,
) {
  const checkers = getRandomPersonas(participants, checkersCount);
  const memberCounts = await Promise.all(
    checkers.map(async (checker) => {
      const members = await checker.worker!.getMembers(groupId);
      console.log(
        `[TEST] Member count verified by ${checker.address}: ${members.length}`,
      );
      return members.length;
    }),
  );

  return memberCounts[0];
}

async function verifyStreams(
  creator: Persona,
  allParticipants: Persona[],
  groupId: string,
  listenerCount: number,
) {
  const message = `gm-${Math.random().toString(36).substring(2, 8)}`;

  const recipients = getRandomPersonas(allParticipants, listenerCount);
  // Set up message reception streams
  const receivePromises = recipients.map(async (recipient) => {
    if (recipient.address !== creator.address) {
      return recipient.worker!.receiveMessage(groupId, message);
    }
  });

  // Send messages
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await creator.worker!.sendMessage(groupId, message);

  // Verify reception
  const receivedMessages = await Promise.all(receivePromises);
  const validMessages = receivedMessages.filter((msg) => msg !== null);

  return {
    receivedMessages,
    validMessages,
  };
}
