import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Groups_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

/* 
Topics:
- Inconsistent test results (~20%).
- Performance issues (>1000ms) for operations
- Old sdk to new sdk breaks (node 41 to 42)
- agent stream failures
- 20% missed streams

*/

describe(testName, () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    groupId: string,
    randomAddress: string;

  beforeAll(async () => {
    const personas = ["bob", "alice", "joe", "bobB41"];
    [bob, alice, joe, bobB41] = await getPersonas(
      personas,
      env,
      testName,
      personas.length,
    );
    const { address } = await getNewRandomPersona(env);
    randomAddress = address;
  }, defaultValues.timeout);

  it(
    "TC_CreateGroup: should measure creating a group",
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
    "TC_UpdateGroupName: should create a group and update group name",
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
    "TC_AddMembers: should measure adding a participant to a group",
    async () => {
      const membersCount = await bob.worker!.addMembers(groupId!, [
        randomAddress!,
      ]);
      console.log("[TEST] Members added", membersCount);
      expect(membersCount).toBe(4);
    },
    defaultValues.timeout,
  );

  it(
    "TC_GetMembersCount: should get members count of a group",
    async () => {
      const members = await bob.worker!.getMembers(groupId!);
      console.log("[TEST] Members count", members.length);
      expect(members.length).toBe(4);
    },
    defaultValues.timeout,
  );

  it(
    "TC_RemoveMembers: should remove a participant from a group",
    async () => {
      const membersCount = await bob.worker!.removeMembers(groupId!, [
        joe.address!,
      ]);
      console.log("[TEST] Members removed", membersCount);
      expect(membersCount).toBe(3);
    },
    defaultValues.timeout,
  );
  it(
    "TC_SendGroupMessage: should measure sending a gm in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await bob.worker!.sendMessage(groupId!, groupMessage);
      console.log("[TEST] GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const bobPromise = bob.worker!.receiveMessage(groupId!, [groupMessage]);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      const received = await bobPromise;

      console.log("[TEST] GM Message received in group", groupMessage);
      expect(received).toContain(groupMessage);
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGroupMessage: should create a group and measure 2 streams catching up a message in a group",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, [
        groupMessage,
      ]);
      const joePromise = joe.worker!.receiveMessage(groupId!, [groupMessage]);

      await bob.worker!.sendMessage(groupId!, groupMessage);
      const [aliceReceived, joeReceived] = await Promise.all([
        alicePromise,
        joePromise,
      ]);
      console.log("[TEST] GM Message received in group", groupMessage);
      console.log("[TEST] Alice received", aliceReceived);
      console.log("[TEST] Joe received", joeReceived);
      expect(aliceReceived).toContain(groupMessage);
      expect(joeReceived).toContain(groupMessage);
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGroupMessageFrom42To41: should measure sending a gm from SDK 42 to 41",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await bob.worker!.addMembers(groupId!, [bobB41.address!]);
      const isMember = await bob.worker!.isMember(groupId!, bobB41.address!);
      console.log("[TEST] Bob 41 is member", isMember);
      expect(isMember).toBe(true);

      const bob41Promise = bobB41.worker!.receiveMessage(groupId!, [
        groupMessage,
      ]);
      const joePromise = joe.worker!.receiveMessage(groupId!, [groupMessage]);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const [joeReceived, bob41Received] = await Promise.all([
        joePromise,
        bob41Promise,
      ]);
      console.log("[TEST] GM Message received in group", groupMessage);
      console.log("[TEST] Joe received", joeReceived);
      console.log("[TEST] Bob 41 received", bob41Received);
      expect(joeReceived).toContain(groupMessage);
      expect(bob41Received).toContain(groupMessage);
    },
    defaultValues.timeout * 2,
  );

  afterAll(() => {
    flushLogger(testName);
  });
});
