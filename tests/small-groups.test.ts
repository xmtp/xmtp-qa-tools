import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  verifyAddRandomMembers,
  verifyGroupNameChange,
  verifyMembersCount,
  verifyRemoveRandomMembers,
  verifyStreams,
} from "../helpers/groups";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getPersonas,
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
      const { successPercentage, validMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        steeamstoVerify,
      );

      expect(successPercentage).toBeGreaterThanOrEqual(currentMemberCount);
      expect(validMessages.length).toBe(steeamstoVerify);
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
        env,
      );

      // High-level expectations about member count
      expect(newMemberCount).toBe(currentMemberCount - 1);
      currentMemberCount = newMemberCount;

      // Verify the member count decreased
      const count3 = await verifyMembersCount(participants, groupId);
      expect(count3).toBe(currentMemberCount);

      await verifyGroupNameChange(participants, groupId);

      // Final verification step
      const { successPercentage, validMessages } = await verifyStreams(
        creator,
        participants,
        groupId,
        currentMemberCount,
      );

      expect(successPercentage).toBeGreaterThanOrEqual(currentMemberCount);
      expect(validMessages.length).toBe(currentMemberCount);
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
