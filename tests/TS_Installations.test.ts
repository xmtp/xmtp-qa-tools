import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  verifyGroupNameChange,
  verifyMembersCount,
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
const testName = "TS_Installations_" + env + ":";
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

  afterAll(() => {
    flushLogger(testName);
  });
});
