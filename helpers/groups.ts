import type { XmtpEnv } from "node-sdk-42";
import { expect } from "vitest";
import {
  getNewRandomPersona,
  getRandomPersonas,
  type Persona,
} from "./personas";

export async function verifyRemoveRandomMembers(
  creator: Persona,
  participants: Persona[],
  groupId: string,
  currentMemberCount: number,
  env: XmtpEnv,
): Promise<number> {
  try {
    const newRandomParticipant = getRandomPersonas(participants, 1)[0];
    expect(newRandomParticipant).toBeDefined();
    expect(newRandomParticipant.address).toBeDefined();

    const membersAfterRemove = await creator.worker?.removeMembers(groupId, [
      newRandomParticipant.address ?? "",
    ]);
    expect(membersAfterRemove).toBe(currentMemberCount - 1);
    return membersAfterRemove ?? 0;
  } catch (error) {
    console.error(
      `[TEST] Error verifying remove random members: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function verifyAddRandomMembers(
  creator: Persona,
  participants: Persona[],
  groupId: string,
  currentMemberCount: number,
  env: XmtpEnv,
): Promise<number> {
  try {
    const newRandomParticipant = await getNewRandomPersona(env);
    expect(newRandomParticipant).toBeDefined();
    expect(newRandomParticipant.address).toBeDefined();

    const membersAfterAdd = await creator.worker?.addMembers(groupId, [
      newRandomParticipant.address,
    ]);
    expect(membersAfterAdd).toBe(currentMemberCount + 1);
    return membersAfterAdd ?? 0;
  } catch (error) {
    console.error(
      `[TEST] Error verifying add random members: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function verifyMembersCount(
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
        const members = await checker.worker?.getMembers(groupId);
        return members?.length ?? 0;
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
    console.error(
      `[TEST] Error verifying members count: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function verifyGroupNameChange(
  participants: Persona[],
  groupId: string,
) {
  try {
    const newGroupName = "name-" + Math.random().toString(36).substring(2, 15);
    const randomParticipants = getRandomPersonas(participants, 3);
    const metadataPromises = randomParticipants.map((p) =>
      p.worker?.receiveMetadata(groupId, newGroupName),
    );

    const newRandomParticipant = getRandomPersonas(participants, 1)[0];
    await newRandomParticipant.worker?.updateGroupName(groupId, newGroupName);

    const metadataReceived = await Promise.all(metadataPromises);
    expect(metadataReceived.length).toBe(randomParticipants.length);
    expect(metadataReceived).toContain(newGroupName);
  } catch (error) {
    console.error(
      `[TEST] Error verifying group name: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function verifyStreams(
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
        return recipient.worker?.receiveMessage(groupId, message);
      }
    });

    // Send messages
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await creator.worker?.sendMessage(groupId, message);

    // Verify reception
    const receivedMessages = await Promise.all(receivePromises);
    const validMessages = receivedMessages.filter((msg) => msg === message);
    const percentageMissed =
      (receivedMessages.length - validMessages.length) /
      receivedMessages.length;
    const successPercentage = (1 - percentageMissed) * 100;

    if (successPercentage < 100) {
      console.warn(
        `[TEST] Success percentage: ${successPercentage}%, missed: ${percentageMissed * 100}%`,
      );
    }
    return {
      receivedMessages,
      validMessages,
      successPercentage,
    };
  } catch (error) {
    console.error(
      `[TEST] Error verifying streams: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      receivedMessages: [],
      validMessages: [],
    };
  }
}
