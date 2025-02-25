import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  WorkerNames,
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

const env: XmtpEnv = "dev";
const testName = "TS_Performance_" + env;

describe(testName, () => {
  let bobsGroup: Conversation;
  let dmConvo: Conversation;
  let personas: Record<string, Persona>;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };
    const logger = createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "joe", "sam", "alice", "randompep", "elon", "random"],
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

  it("TC_CreateDM: should measure creating a DM", async () => {
    dmConvo = await personas[WorkerNames.BOB].client!.conversations.newDm(
      personas["random"].client!.accountAddress,
    );
    expect(dmConvo).toBeDefined();
    expect(dmConvo.id).toBeDefined();
  });

  it("TC_SendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas[WorkerNames.BOB].name}] Creating DM with ${personas[WorkerNames.SAM].name} at ${personas[WorkerNames.SAM].client?.accountAddress}`,
    );

    const dmId = await dmConvo.send(message);

    expect(dmId).toBeDefined();
  });

  it("TC_ReceiveGM: should measure receiving a gm", async () => {
    const dmConvo = await personas[WorkerNames.BOB].client?.conversations.newDm(
      personas[WorkerNames.SAM].client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const verifyResult = await verifyStream(
      dmConvo,
      [personas[WorkerNames.SAM]],
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("TC_CreateGroup: should measure creating a group", async () => {
    console.time("create group");
    bobsGroup = await personas[WorkerNames.BOB].client!.conversations.newGroup(
      Object.values(personas)
        .filter((p) => p.name !== "randompep")
        .map((p) => p.client?.accountAddress as `0x${string}`),
    );
    console.log("Bob's group", bobsGroup.id);
    console.timeEnd("create group");
    expect(bobsGroup.id).toBeDefined();
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
      [personas["elon"]],
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
      personas["randompep"].client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("add members");
    expect(members.length).toBe(previousMembers.length + 1);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    const previousMembers = await bobsGroup.members();
    await bobsGroup.removeMembers([
      personas[WorkerNames.JOE].client?.accountAddress as `0x${string}`,
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
    const verifyResult = await verifyStream(
      bobsGroup,
      [personas[WorkerNames.ELON]],
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("TC_ReceiveGroupMessage: should create a group and measure 2 streams catching up a message in a group", async () => {
    const newGroup = await personas[
      WorkerNames.BOB
    ].client!.conversations.newGroup(
      Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    );

    const verifyResult = await verifyStream(
      newGroup,
      Object.values(personas).map((p) => p),
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });
});
