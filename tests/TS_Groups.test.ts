import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  PersonaFactory,
  type Persona,
} from "../helpers/personas";
import {
  verifyMetadataUpdates,
  type Conversation,
  type XmtpEnv,
} from "../helpers/xmtp";

const env: XmtpEnv = "dev";
const testName = "TS_Groups_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

/* 
Topics:
- Verify group creation with different participants for incosisten stream results


*/

describe(testName, () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobsGroup: Conversation,
    randompep: Persona,
    elon: Persona;

  beforeAll(async () => {
    const personaFactory = new PersonaFactory(env, testName);
    [bob, alice, joe, randompep, elon] = await personaFactory.getPersonas([
      "bob",
      "alice",
      "joe",
      "randompep",
      "elon",
    ]);
    expect(bob).toBeDefined();
    expect(alice).toBeDefined();
    expect(joe).toBeDefined();
    expect(randompep).toBeDefined();
  }, defaultValues.timeout);

  it(
    "TC_CreateGroup: should measure creating a group",
    async () => {
      console.time("create group");
      bobsGroup = await bob.client!.conversations.newGroup([
        bob.client?.accountAddress as `0x${string}`,
        joe.client?.accountAddress as `0x${string}`,
        elon.client?.accountAddress as `0x${string}`,
      ]);
      console.log("[TEST] Bob's group", bobsGroup.id);
      console.timeEnd("create group");
      expect(bobsGroup.id).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_UpdateGroupName: should create a group and update group name",
    async () => {
      console.time("update group name");
      const newGroupName =
        "New Group Name" + Math.random().toString(36).substring(2, 15);

      const result = await verifyMetadataUpdates(
        bobsGroup.id,
        bob,
        joe,
        "group_name",
        newGroupName,
      );
      expect(result).toBe(true);
      console.timeEnd("update group name");
    },
    defaultValues.timeout,
  );

  it(
    "TC_AddMembers: should measure adding a participant to a group",
    async () => {
      console.time("add members");
      await bobsGroup.addMembers([
        randompep.client?.accountAddress as `0x${string}`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const members = await bobsGroup.members();
      console.timeEnd("add members");
      expect(members.length).toBe(4);
    },
    defaultValues.timeout,
  );

  it(
    "TC_GetMembersCount: should get members count of a group",
    async () => {
      console.time("get members count");
      const members = await bobsGroup.members();
      console.timeEnd("get members count");
      expect(members.length).toBe(4);
    },
    defaultValues.timeout,
  );

  it(
    "TC_RemoveMembers: should remove a participant from a group",
    async () => {
      console.time("remove members");
      await bobsGroup.removeMembers([
        joe.client?.accountAddress as `0x${string}`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const members = await bobsGroup.members();
      console.timeEnd("remove members");
      expect(members.length).toBe(3);
    },
    defaultValues.timeout,
  );

  // it(
  //   "TC_SendGroupMessage: should measure sending a gm in a group",
  //   async () => {
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     await bob.client!.conversations.sendMessage(groupId!, groupMessage);
  //     console.log("[TEST] GM Message sent in group", groupMessage);
  //     expect(groupMessage).toBeDefined();
  //   },
  //   defaultValues.timeout,
  // );

  // it(
  //   "TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group",
  //   async () => {
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     const bobPromise = bob.worker!.receiveMessage(groupMessage);

  //     await alice.worker!.sendMessage(groupId!, groupMessage);
  //     const received = await bobPromise;

  //     console.log("[TEST] GM Message received in group", groupMessage);
  //     expect(received).toContain(groupMessage);
  //   },
  //   defaultValues.timeout,
  // );

  // it(
  //   "TC_ReceiveGroupMessage: should create a group and measure 2 streams catching up a message in a group",
  //   async () => {
  //     groupId = await bob.worker!.createGroup([
  //       joe.address,
  //       bob.address,
  //       alice.address,
  //     ]);
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     const alicePromise = alice.worker!.receiveMessage(groupMessage);
  //     const joePromise = joe.worker!.receiveMessage(groupMessage);

  //     await bob.worker!.sendMessage(groupId!, groupMessage);
  //     const [aliceReceived, joeReceived] = await Promise.all([
  //       alicePromise,
  //       joePromise,
  //     ]);
  //     console.log("[TEST] GM Message received in group", groupMessage);
  //     console.log("[TEST] Alice received", aliceReceived);
  //     console.log("[TEST] Joe received", joeReceived);
  //     expect(aliceReceived).toContain(groupMessage);
  //     expect(joeReceived).toContain(groupMessage);
  //   },
  //   defaultValues.timeout,
  // );

  // it(
  //   "TC_ReceiveGroupMessageFrom42To41: should measure sending a gm from SDK 42 to 41",
  //   async () => {
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     await bob.worker!.addMembers(groupId!, [bobB41.address]);
  //     const isMember = await bob.worker!.isMember(groupId!, bobB41.address);
  //     console.log("[TEST] Bob 41 is member", isMember);
  //     expect(isMember).toBe(true);

  //     const bob41Promise = bobB41.worker!.receiveMessage(groupMessage);
  //     const joePromise = joe.worker!.receiveMessage(groupMessage);

  //     await alice.worker!.sendMessage(groupId!, groupMessage);
  //     await new Promise((resolve) => setTimeout(resolve, 2000));
  //     const [joeReceived, bob41Received] = await Promise.all([
  //       joePromise,
  //       bob41Promise,
  //     ]);
  //     console.log("[TEST] GM Message received in group", groupMessage);
  //     console.log("[TEST] Joe received", joeReceived);
  //     console.log("[TEST] Bob 41 received", bob41Received);
  //     expect(joeReceived).toContain(groupMessage);
  //     expect(bob41Received).toContain(groupMessage);
  //   },
  //   defaultValues.timeout * 2,
  // );

  afterAll(() => {
    flushLogger(testName);
  });
});
