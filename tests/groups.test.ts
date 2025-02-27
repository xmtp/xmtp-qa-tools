import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const env: XmtpEnv = "dev";
const testName = "groups" + env;

dotenv.config();

describe(testName, () => {
  let personas: Record<string, Persona>;
  let bobsGroup: Conversation;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "alice", "joe", "randompep", "elon"],
      env,
      testName,
    );
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateGroup: should measure creating a group", async () => {
    console.time("create group");
    bobsGroup = await personas.bob.client!.conversations.newGroup([
      personas.alice.client!.accountAddress as `0x${string}`,
      personas.joe.client!.accountAddress as `0x${string}`,
      personas.elon.client!.accountAddress as `0x${string}`,
    ]);
    console.log("Bob's group", bobsGroup.id);
    console.timeEnd("create group");
    expect(bobsGroup.id).toBeDefined();
  });

  it("TC_CreateGroup: should measure creating a group with inbox ids", async () => {
    console.time("bobsGroupByInboxIds");

    const bobsGroupByInboxIds =
      await personas.bob.client!.conversations.newGroupByInboxIds([
        personas.alice.client!.inboxId,
        personas.joe.client!.inboxId,
        personas.elon.client!.inboxId,
      ]);

    console.log("bobsGroupByInboxIds", bobsGroupByInboxIds.id);
    console.timeEnd("bobsGroupByInboxIds");
    expect(bobsGroupByInboxIds.id).toBeDefined();
  });

  it("TC_UpdateGroupName: should create a group and update group name", async () => {
    console.time("update group name");

    const nameUpdateGenerator = async (i: number, suffix: string) => {
      return `New name-${i + 1}-${suffix}`;
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      await group.updateName(newName);
    };

    const result = await verifyStream(
      bobsGroup,
      [personas.elon],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );
    expect(result.allReceived).toBe(true);
    console.timeEnd("update group name");
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    console.time("add members");
    const previousMembers = await bobsGroup.members();
    await bobsGroup.addMembers([
      personas.randompep.client!.accountAddress as `0x${string}`,
    ]);
    console.time("sync");
    await bobsGroup.sync();
    console.timeEnd("sync");
    const members = await bobsGroup.members();
    console.timeEnd("add members");
    expect(members.length).toBe(previousMembers.length + 1);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    const previousMembers = await bobsGroup.members();
    await bobsGroup.removeMembers([
      personas.joe.client!.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("remove members");
    expect(members.length).toBe(previousMembers.length - 1);
  });

  it("TC_SendGroupMessage: should measure sending a gm in a group", async () => {
    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

    await bobsGroup.send(groupMessage);
    console.log("GM Message sent in group", groupMessage);
    expect(groupMessage).toBeDefined();
  });

  it("TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group", async () => {
    // Wait for participants to see it with increased timeout
    const verifyResult = await verifyStream(
      bobsGroup,
      [personas.elon],
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("TC_ReceiveGroupMessage: should create a group and measure all streams", async () => {
    const newGroup = await personas.bob.client!.conversations.newGroup(
      Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    );
    const verifyResult = await verifyStream(
      newGroup,
      Object.values(personas),
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("TC_CreateLargeGroup: should create a large group of 20 participants", async () => {
    const group = await personas[
      "bob"
    ].client!.conversations.newGroupByInboxIds(
      Object.values(personas).map((p) => p.client?.inboxId as string),
    );
    expect(group.id).toBeDefined();
  });

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
  // );
});
