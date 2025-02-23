import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  participantNames,
  PersonaFactory,
  type Persona,
} from "../helpers/personas";
import {
  verifyAddRandomMembers,
  verifyGroupNameChange,
  verifyMembersCount,
  verifyRemoveRandomMembers,
  verifyStreams,
  type XmtpEnv,
} from "../helpers/xmtp";

const env: XmtpEnv = "dev";
const testName = "TS_Small_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);
const personaFactory = new PersonaFactory(env, testName);

/* 
TODO
- Stress groups (200 users.installations, who sends, who was added last)
*/

describe(testName, () => {
  let participants: Persona[] = [];
  let groupId: string;
  let creator: Persona;
  let currentMemberCount: number;

  beforeAll(async () => {
    // Get all personas at once
    participants = await personaFactory.getPersonas(participantNames, 10);
    creator = participants[0];
    currentMemberCount = participants.length;

    // Create the group that will be used across all tests
    console.log("[TEST] Creating group with participants:", currentMemberCount);
    const addresses = participants.map((p) => p.address);
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
      const { validMessages, successPercentage } = await verifyStreams(
        creator,
        participants,
        groupId,
        steeamstoVerify,
      );

      expect(validMessages.length).toBe(steeamstoVerify);
      expect(successPercentage).toBeGreaterThanOrEqual(currentMemberCount);
    },
    defaultValues.timeout,
  );

  it(
    "should handle adding new and removing members",
    async () => {
      // Verify current count before adding
      const count = await verifyMembersCount(participants, groupId);
      expect(count).toBe(currentMemberCount);

      const newMemberCount = await verifyAddRandomMembers(
        creator,
        groupId,
        currentMemberCount,
        env,
      );

      // High-level expectations about member count
      expect(newMemberCount).toBe(currentMemberCount + 1);
      currentMemberCount = newMemberCount;

      // Verify the member count increased
      const count1 = await verifyMembersCount(participants, groupId);
      expect(count1).toBe(currentMemberCount);

      // Final verification step
      const steeamstoVerify = 5;
      const {
        successPercentage: successPercentage1,
        validMessages: validMessages1,
      } = await verifyStreams(creator, participants, groupId, steeamstoVerify);

      expect(successPercentage1).toBeGreaterThanOrEqual(currentMemberCount);
      expect(validMessages1.length).toBe(steeamstoVerify);

      // Verify current count before removing
      const count2 = await verifyMembersCount(participants, groupId);
      expect(count2).toBe(currentMemberCount);

      const newMemberCount2 = await verifyRemoveRandomMembers(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      // High-level expectations about member count
      expect(newMemberCount2).toBe(currentMemberCount - 1);
      currentMemberCount = newMemberCount2;

      // Verify the member count decreased
      const count3 = await verifyMembersCount(participants, groupId);
      expect(count3).toBe(currentMemberCount);

      await verifyGroupNameChange(participants, groupId);

      // Final verification step
      const {
        successPercentage: successPercentage2,
        validMessages: validMessages2,
      } = await verifyStreams(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      expect(successPercentage2).toBeGreaterThanOrEqual(80);
      expect(validMessages2.length).toBe(currentMemberCount);
    },
    defaultValues.timeout,
  );

  it(
    "should handle streams",
    async () => {
      // Final verification step
      const {
        successPercentage: successPercentage1,
        validMessages: validMessages1,
      } = await verifyStreams(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      expect(successPercentage1).toBeGreaterThanOrEqual(currentMemberCount);
      expect(validMessages1.length).toBe(currentMemberCount);

      // Final verification step
      const {
        successPercentage: successPercentage2,
        validMessages: validMessages2,
      } = await verifyStreams(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      expect(successPercentage2).toBeGreaterThanOrEqual(currentMemberCount);
      expect(validMessages2.length).toBe(currentMemberCount);
    },
    defaultValues.timeout,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
