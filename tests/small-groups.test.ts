import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  getRandomPersonas,
  participantNames,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Small_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let participants: Persona[] = [];
  let groupId: string;
  let creator: Persona;
  let currentMemberCount: number;

  beforeAll(async () => {
    // Get all personas at once
    participants = await getPersonas(participantNames, env, testName, 10);
    creator = participants[0];
    currentMemberCount = participants.length;

    // Create the group that will be used across all tests
    console.log("[TEST] Creating group with participants:", currentMemberCount);
    const addresses = participants.map((p) => p.address!);
    groupId = await creator.worker!.createGroup(addresses);

    // Verify initial member count
    const count = await verifyMembersCount(participants, groupId);
    expect(count).toBe(currentMemberCount);
  }, defaultValues.timeout);

  it(
    "should handle group name updates",
    async () => {
      // Verify initial state
      expect(participants.length).toBeGreaterThan(0);
      expect(groupId).toBeDefined();

      await verifyGroupNameChange(participants, groupId);

      // Final verification step
      const steeamstoVerify = 3;
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        steeamstoVerify,
      );
      expect(validMessages.length).toBe(steeamstoVerify);
      expect(receivedMessages).toBeDefined();
      expect(receivedMessages.every((msg) => msg !== undefined)).toBe(true);
    },
    defaultValues.timeout,
  );

  it(
    "should handle adding new members",
    async () => {
      // Verify current count before adding
      const count = await verifyMembersCount(participants, groupId);
      expect(count).toBe(currentMemberCount);

      const newMemberCount = await verifyAddRandomMembers(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      // High-level expectations about member count
      expect(newMemberCount).toBe(currentMemberCount + 1);
      currentMemberCount = newMemberCount;

      // Verify the member count increased
      const count1 = await verifyMembersCount(participants, groupId);
      expect(count1).toBe(currentMemberCount);

      // Final verification step
      const steeamstoVerify = 5;
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        steeamstoVerify,
      );
      expect(validMessages.length).toBe(steeamstoVerify);
      expect(receivedMessages).toBeDefined();
      expect(receivedMessages.filter(Boolean).length).toBe(steeamstoVerify);
    },
    defaultValues.timeout,
  );

  it(
    "should handle removing members",
    async () => {
      // Verify current count before removing
      const count2 = await verifyMembersCount(participants, groupId);
      expect(count2).toBe(currentMemberCount);

      const newMemberCount = await verifyRemoveRandomMembers(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      // High-level expectations about member count
      expect(newMemberCount).toBe(currentMemberCount - 1);
      currentMemberCount = newMemberCount;

      // Verify the member count decreased
      const count3 = await verifyMembersCount(participants, groupId);
      expect(count3).toBe(currentMemberCount);

      await verifyGroupNameChange(participants, groupId);

      // Final verification step
      const { validMessages, receivedMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        5,
      );
      expect(validMessages.length).toBe(5);
      expect(receivedMessages).toBeDefined();
      expect(receivedMessages.some(Boolean)).toBe(true); // At least some messages received
    },
    defaultValues.timeout,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});

async function verifyRemoveRandomMembers(
  creator: Persona,
  participants: Persona[],
  groupId: string,
  currentMemberCount: number,
): Promise<number> {
  try {
    const newRandomParticipant = getRandomPersonas(participants, 1)[0];
    expect(newRandomParticipant).toBeDefined();
    expect(newRandomParticipant.address).toBeDefined();

    const membersAfterRemove = await creator.worker!.removeMembers(groupId, [
      newRandomParticipant.address!,
    ]);
    expect(membersAfterRemove).toBe(currentMemberCount - 1);
    return membersAfterRemove;
  } catch (error) {
    console.error(`[TEST] Error verifying remove random members: ${error}`);
    throw error;
  }
}

async function verifyAddRandomMembers(
  creator: Persona,
  participants: Persona[],
  groupId: string,
  currentMemberCount: number,
): Promise<number> {
  try {
    const newRandomParticipant = await getNewRandomPersona(env);
    expect(newRandomParticipant).toBeDefined();
    expect(newRandomParticipant.address).toBeDefined();

    const membersAfterAdd = await creator.worker!.addMembers(groupId, [
      newRandomParticipant.address,
    ]);
    expect(membersAfterAdd).toBe(currentMemberCount + 1);
    return membersAfterAdd;
  } catch (error) {
    console.error(`[TEST] Error verifying add random members: ${error}`);
    throw error;
  }
}

async function verifyMembersCount(
  participants: Persona[],
  groupId: string,
): Promise<number> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const checkersCount =
      Math.floor(Math.random() * (participants.length - 1)) + 1;
    const checkers = getRandomPersonas(participants, checkersCount);
    const memberCounts = await Promise.all(
      checkers.map(async (checker) => {
        const members = await checker.worker!.getMembers(groupId);
        return members.length;
      }),
    );

    // Find the most common count
    const countMap = memberCounts.reduce<Record<number, number>>(
      (acc, count) => {
        acc[count] = (acc[count] || 0) + 1;
        return acc;
      },
      {},
    );

    // Get the count that appears most frequently
    const [mostCommonCount] = Object.entries(countMap).sort(
      ([, a], [, b]) => b - a,
    )[0];

    console.log(
      `[TEST] Member count verified by ${checkers[0].address}: ${mostCommonCount}`,
    );
    return parseInt(mostCommonCount);
  } catch (error) {
    console.error(`[TEST] Error verifying members count: ${error}`);
    throw error;
  }
}

async function verifyGroupNameChange(participants: Persona[], groupId: string) {
  try {
    const newGroupName = "name-" + Math.random().toString(36).substring(2, 15);
    const randomParticipants = getRandomPersonas(participants, 3);
    const metadataPromises = randomParticipants.map((p) =>
      p.worker!.receiveMetadata(groupId, newGroupName),
    );

    const newRandomParticipant = getRandomPersonas(participants, 1)[0];
    await newRandomParticipant.worker!.updateGroupName(groupId, newGroupName);

    const metadataReceived = await Promise.all(metadataPromises);
    expect(metadataReceived.length).toBe(randomParticipants.length);
    expect(metadataReceived).toContain(newGroupName);
  } catch (error) {
    console.error(`[TEST] Error verifying group name: ${error}`);
    throw error;
  }
}

async function verifyStreams(
  creator: Persona,
  allParticipants: Persona[],
  groupId: string,
  listenerCount: number,
) {
  try {
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
  } catch (error) {
    console.error(`[TEST] Error verifying streams: ${error}`);
    return {
      receivedMessages: [],
      validMessages: [],
    };
  }
}
