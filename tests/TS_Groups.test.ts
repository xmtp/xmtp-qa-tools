import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  verifyDM,
  verifyMetadataUpdates,
  type Conversation,
  type XmtpEnv,
} from "../helpers/verify";
import {
  defaultValues,
  getWorkers,
  type Persona,
} from "../helpers/workers/creator";

const env: XmtpEnv = "dev";
const testName = "TS_Groups_" + env;

/* 
TODO:
- Verify group creation with different participants for incosisten stream results


*/

describe(testName, () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobsGroup: Conversation,
    randompep: Persona,
    elon: Persona;
  let personas: Persona[];

  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "alice", "joe", "randompep", "elon"],
      env,
      testName,
    );
    [bob, alice, joe, randompep, elon] = personas;
    expect(bob).toBeDefined();
    expect(alice).toBeDefined();
    expect(joe).toBeDefined();
    expect(randompep).toBeDefined();
  }, defaultValues.timeout);

  afterAll(async () => {
    flushLogger(testName);
    await Promise.all(
      personas.map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it(
    "TC_CreateGroup: should measure creating a group",
    async () => {
      console.time("create group");
      bobsGroup = await bob.client!.conversations.newGroup([
        bob.client?.accountAddress as `0x${string}`,
        joe.client?.accountAddress as `0x${string}`,
        alice.client?.accountAddress as `0x${string}`,
        elon.client?.accountAddress as `0x${string}`,
      ]);
      console.log("Bob's group", bobsGroup.id);
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
        () => bobsGroup.updateName(newGroupName),
        [elon],
        { fieldName: "group_name", newValue: newGroupName },
      );
      expect(result).toEqual([newGroupName]);
      console.timeEnd("update group name");
    },
    defaultValues.timeout,
  );

  it(
    "TC_AddMembers: should measure adding a participant to a group",
    async () => {
      console.time("add members");
      const previousMembers = await bobsGroup.members();
      await bobsGroup.addMembers([
        randompep.client?.accountAddress as `0x${string}`,
      ]);
      const members = await bobsGroup.members();
      console.timeEnd("add members");
      expect(members.length).toBe(previousMembers.length + 1);
    },
    defaultValues.timeout,
  );

  it(
    "TC_RemoveMembers: should remove a participant from a group",
    async () => {
      console.time("remove members");
      const previousMembers = await bobsGroup.members();
      await bobsGroup.removeMembers([
        joe.client?.accountAddress as `0x${string}`,
      ]);
      const members = await bobsGroup.members();
      console.timeEnd("remove members");
      expect(members.length).toBe(previousMembers.length - 1);
    },
    defaultValues.timeout,
  );

  it(
    "TC_SendGroupMessage: should measure sending a gm in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await bobsGroup.send(groupMessage);
      console.log("GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group",
    async () => {
      try {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        // Wait for participants to see it with increased timeout
        const parsedMessages = await verifyDM(
          () => bobsGroup.send(groupMessage),
          [elon],
        );

        parsedMessages.forEach((msg) => {
          expect(msg).toBe(groupMessage);
        });
      } catch (error) {
        console.error("Failed to receive group message:", error);
        throw error; // Re-throw to fail the test
      }
    },
    defaultValues.timeout * 2,
  );

  it(
    "TC_ReceiveGroupMessage: should create a group and measure 2 streams catching up a message in a group",
    async () => {
      const newGroup = await bob.client!.conversations.newGroup([
        alice.client?.accountAddress as `0x${string}`,
        joe.client?.accountAddress as `0x${string}`,
        randompep.client?.accountAddress as `0x${string}`,
        elon.client?.accountAddress as `0x${string}`,
      ]);
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      // Wait for Joe to see it
      const parsedMessages = await verifyDM(
        () => newGroup.send(groupMessage),
        [joe, alice, randompep, elon],
      );
      parsedMessages.forEach((msg) => {
        expect(msg).toBe(groupMessage);
      });
    },
    defaultValues.timeout * 2,
  );

  // it(
  //   "TC_ReceiveGroupMessageFrom42To41: should measure sending a gm from SDK 42 to 41",
  //   async () => {
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     await bob.worker!.addMembers(groupId!, [bobB41.address]);
  //     const isMember = await bob.worker!.isMember(groupId!, bobB41.address);
  //     console.log("Bob 41 is member", isMember);
  //     expect(isMember).toBe(true);

  //     const bob41Promise = bobB41.worker!.receiveMessage(groupMessage);
  //     const joePromise = joe.worker!.receiveMessage(groupMessage);

  //     await alice.worker!.sendMessage(groupId!, groupMessage);
  //     await new Promise((resolve) => setTimeout(resolve, 2000));
  //     const [joeReceived, bob41Received] = await Promise.all([
  //       joePromise,
  //       bob41Promise,
  //     ]);
  //     console.log("GM Message received in group", groupMessage);
  //     console.log("Joe received", joeReceived);
  //     console.log("Bob 41 received", bob41Received);
  //     expect(joeReceived).toBe(groupMessage);
  //     expect(bob41Received).toBe(groupMessage);
  //   },
  //   defaultValues.timeout * 2,
  // );

  afterAll(() => {
    flushLogger(testName);
  });
});
