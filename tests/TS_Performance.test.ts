import type { Conversation } from "@xmtp/node-sdk";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { closeEnv, loadEnv } from "../helpers/client";
import { sendMetric } from "../helpers/datadog";
import type { Persona } from "../helpers/types";
import { getPersonasFromGroup, verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "ts_performance";
await loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
    personas = await getWorkers(["bob", "joe", "sam", "random"], testName);
  });

  beforeEach(() => {
    start = performance.now();
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName;
    if (testName) {
      void sendMetric(performance.now() - start, testName, personas);
    }
  });

  it("createDM: should measure creating a DM", async () => {
    convo = await personas.bob.client!.conversations.newDm(
      personas.random.client!.accountAddress,
    );

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("sendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas.bob.name}] Creating DM with ${personas.random.name} at ${personas.random.client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("receiveGM: should measure receiving a gm", async () => {
    const verifyResult = await verifyStream(convo, [personas.random]);

    expect(verifyResult.messages.length).toEqual(1);
    expect(verifyResult.allReceived).toBe(true);
  });

  let groupPersonas: Record<string, Persona>;
  let group: Conversation;

  beforeAll(async () => {
    groupPersonas = await getWorkers(
      [
        "henry",
        "ivy",
        "jack",
        "karen",
        "larry",
        "mary",
        "nancy",
        "oscar",
        "randomguy",
        "zack",
        "adam",
        "bella",
        "carl",
        "diana",
        "eric",
        "fiona",
        "george",
        "hannah",
        "ian",
        "julia",
        "keith",
        "lisa",
        "mike",
        "nina",
        "oliver",
        "penny",
        "quentin",
        "rosa",
        "sam",
        "tina",
        "uma",
        "vince",
        "walt",
        "xena",
        "yara",
        "zara",
        "guada",
      ],
      testName,
    );
  });

  beforeEach(() => {
    start = performance.now();
  });

  afterAll(async () => {
    await closeEnv(testName, groupPersonas);
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName;
    if (testName) {
      void sendMetric(performance.now() - start, testName, groupPersonas);
    }
  });
  it("createGroup: should measure creating a group", async () => {
    console.time("create group");
    group = await groupPersonas.henry.client!.conversations.newGroup([
      groupPersonas.ivy.client!.accountAddress as `0x${string}`,
      groupPersonas.jack.client!.accountAddress as `0x${string}`,
      groupPersonas.karen.client!.accountAddress as `0x${string}`,
      groupPersonas.nancy.client!.accountAddress as `0x${string}`,
      groupPersonas.oscar.client!.accountAddress as `0x${string}`,
      groupPersonas.mary.client!.accountAddress as `0x${string}`,
      groupPersonas.larry.client!.accountAddress as `0x${string}`,
    ]);
    console.log("Henry's group", group.id);
    console.timeEnd("create group");
    expect(group.id).toBeDefined();
  });

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    console.time("Henry's groupByInboxIds");

    const groupByInboxIds =
      await groupPersonas.henry.client!.conversations.newGroupByInboxIds([
        groupPersonas.ivy.client!.inboxId,
        groupPersonas.jack.client!.inboxId,
        groupPersonas.karen.client!.inboxId,
      ]);

    console.log("Henry's groupByInboxIds", groupByInboxIds.id);
    console.timeEnd("Henry's groupByInboxIds");
    expect(groupByInboxIds.id).toBeDefined();
  });

  it("updateGroupName: should create a group and update group name", async () => {
    console.time("update group name");

    const nameUpdateGenerator = (i: number, suffix: string) => {
      return `New name-${i + 1}-${suffix}`;
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      await group.updateName(newName);
    };

    const result = await verifyStream(
      group,
      [groupPersonas.nancy],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );
    expect(result.allReceived).toBe(true);
    console.timeEnd("update group name");
  });

  it("addMembers: should measure adding a participant to a group", async () => {
    console.time("add members");
    const previousMembers = await group.members();
    await group.addMembers([
      groupPersonas.randomguy.client!.accountAddress as `0x${string}`,
    ]);
    console.time("sync");
    await group.sync();
    console.timeEnd("sync");
    const members = await group.members();
    console.timeEnd("add members");
    expect(members.length).toBe(previousMembers.length + 1);
  });

  it("removeMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    const previousMembers = await group.members();
    await group.removeMembers([
      groupPersonas.nancy.client!.accountAddress as `0x${string}`,
    ]);
    const members = await group.members();
    console.timeEnd("remove members");
    expect(members.length).toBe(previousMembers.length - 1);
  });

  it("sendGroupMessage: should measure sending a gm in a group", async () => {
    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

    await group.send(groupMessage);
    console.log("GM Message sent in group", groupMessage);
    expect(groupMessage).toBeDefined();
  });

  it("receiveGroupMessage: should create a group and measure all streams", async () => {
    const personasToVerify = await getPersonasFromGroup(group, groupPersonas);
    const verifyResult = await verifyStream(group, personasToVerify);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("createGroup20: should create a large group of 20 participants", async () => {
    group = await groupPersonas.henry.client!.conversations.newGroupByInboxIds(
      Object.values(groupPersonas).map((p) => p.client?.inboxId as string),
    );
    expect(group.id).toBeDefined();
  });

  it("sendGroupMessage20: should measure sending a gm in a group", async () => {
    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

    await group.send(groupMessage);
    console.log("GM Message sent in group", groupMessage);
    expect(groupMessage).toBeDefined();
  });

  it("receiveGroupMessage20: should create a group and measure all streams", async () => {
    const personasToVerify = await getPersonasFromGroup(group, groupPersonas);
    const verifyResult = await verifyStream(group, personasToVerify);
    expect(verifyResult.allReceived).toBe(true);
  });
});
