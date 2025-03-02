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
import { type Conversation, type Persona } from "../helpers/types";
import { getPersonasFromGroup, verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "groups";
await loadEnv(testName);

describe(testName, () => {
  let groupPersonas: Record<string, Persona>;
  let group: Conversation;
  let start: number;

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

    const result = await verifyStream(
      group,
      [groupPersonas.nancy],
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
