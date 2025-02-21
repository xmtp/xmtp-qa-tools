import type { XmtpEnv } from "node-sdk-42";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Performance_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Performance test for sending gm, creating group, and sending gm in group", () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    dmId: string,
    groupId: string,
    randomAddress: string,
    sam: Persona;

  beforeAll(async () => {
    [bob, alice, joe, bobB41, sam] = await getPersonas(
      ["bob", "alice", "joe", "bobB41", "sam"],
      env,
      testName,
      4,
    );
    const { address } = await getNewRandomPersona(env);
    randomAddress = address;
  }, defaultValues.timeout);

  it(
    "should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(randomAddress);
      console.log("[TEST] DM ID", dmId);
      expect(dmId).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      await bob.worker!.sendMessage(dmId!, gmMessage);
      console.log("[TEST] GM Message sent", gmMessage);
      expect(gmMessage).toBeDefined();
    },
    defaultValues.timeout,
  );
  it(
    "should measure creating a group",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      console.log("[TEST] Group created", groupId);
      expect(groupId).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should create a group and update group name",
    async () => {
      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);

      const joePromise = joe.worker!.receiveMetadata(groupId!, newGroupName);
      await bob.worker!.updateGroupName(groupId, newGroupName);
      const joeReceived = await joePromise;

      console.log("[TEST] Joe received group name", joeReceived);
      expect(joeReceived).toBe(newGroupName);
    },
    defaultValues.timeout,
  );

  it(
    `should measure adding a participant to a group`,
    async () => {
      console.time("[TEST] testing adding a participant to a group");
      const membersCount = await bob.worker!.addMembers(groupId!, [
        sam.address!,
      ]);
      console.timeEnd("[TEST] testing adding a participant to a group");
      console.log("[TEST] Members added", membersCount);
      expect(membersCount).toBe(4);
    },
    defaultValues.timeout,
  );
  it(
    `should get members count of a group`,
    async () => {
      const members = await bob.worker!.getMembers(groupId!);
      console.log("[TEST] Members count", members.length);
      expect(members.length).toBe(4);
    },
    defaultValues.timeout,
  );

  it(
    "should remove a participant from a group",
    async () => {
      const membersCount = await bob.worker!.removeMembers(groupId!, [
        sam.address!,
      ]);
      console.log("[TEST] Members removed", membersCount);
      expect(membersCount).toBe(3);
    },
    defaultValues.timeout,
  );
  it(
    "should measure sending a gm in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await bob.worker!.sendMessage(groupId!, groupMessage);
      console.log("[TEST] GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "should measure 1 stream catching up a message in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      const received = await joePromise;

      console.log("[TEST] GM Message received in group", groupMessage);
      expect(received).toBe(groupMessage);
    },
    defaultValues.timeout,
  );
  it(
    "should create a group and measure 2 streams catching up a message in a group",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, groupMessage);
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await bob.worker!.sendMessage(groupId!, groupMessage);
      const [aliceReceived, joeReceived] = await Promise.all([
        alicePromise,
        joePromise,
      ]);
      console.log("[TEST] GM Message received in group", groupMessage);
      console.log("[TEST] Alice received", aliceReceived);
      console.log("[TEST] Joe received", joeReceived);
      expect(aliceReceived).toBe(groupMessage);
      expect(joeReceived).toBe(groupMessage);
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm from SDK 42 to 41",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const bob41Promise = bobB41.worker!.receiveMessage(
        groupId!,
        groupMessage,
      );
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      const [joeReceived, bob41Received] = await Promise.all([
        joePromise,
        bob41Promise,
      ]);
      console.log("[TEST] GM Message received in group", groupMessage);
      console.log("[TEST] Joe received", joeReceived);
      console.log("[TEST] Bob 41 received", bob41Received);
      expect(joeReceived).toBe(groupMessage);
      expect(bob41Received).toBe(groupMessage);
    },
    defaultValues.timeout,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
