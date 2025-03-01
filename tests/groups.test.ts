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
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "groups";
await loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
  let group: Conversation;
  let start: number;
  const gmMessageGenerator = (i: number, suffix: string) => {
    return `gm-${i + 1}-${suffix}`;
  };
  const gmSender = async (convo: Conversation, message: string) => {
    await convo.send(message);
  };

  beforeAll(async () => {
    personas = await getWorkers(
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
      ],
      testName,
    );
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
      sendMetric(performance.now() - start, testName);
    }
  });
  it("createGroup: should measure creating a group", async () => {
    console.time("create group");
    group = await personas.henry.client!.conversations.newGroup([
      personas.ivy.client!.accountAddress as `0x${string}`,
      personas.jack.client!.accountAddress as `0x${string}`,
      personas.karen.client!.accountAddress as `0x${string}`,
      personas.nancy.client!.accountAddress as `0x${string}`,
      personas.oscar.client!.accountAddress as `0x${string}`,
      personas.mary.client!.accountAddress as `0x${string}`,
      personas.larry.client!.accountAddress as `0x${string}`,
    ]);
    console.log("Henry's group", group.id);
    console.timeEnd("create group");
    expect(group.id).toBeDefined();
  });

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    console.time("Henry's groupByInboxIds");

    const groupByInboxIds =
      await personas.henry.client!.conversations.newGroupByInboxIds([
        personas.ivy.client!.inboxId,
        personas.jack.client!.inboxId,
        personas.karen.client!.inboxId,
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
      [personas.nancy],
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
      personas.randomguy.client!.accountAddress as `0x${string}`,
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
      personas.nancy.client!.accountAddress as `0x${string}`,
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

  it("receiveGroupMessage: should measure 1 stream catching up a message in a group", async () => {
    // Wait for participants to see it with increased timeout
    const verifyResult = await verifyStream(
      group,
      [personas.oscar],
      gmMessageGenerator,
      gmSender,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("receiveGroupMessage: should create a group and measure all streams", async () => {
    const newGroup = await personas.henry.client!.conversations.newGroup(
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

  it("createLargeGroup: should create a large group of 20 participants", async () => {
    const group = await personas.henry.client!.conversations.newGroupByInboxIds(
      Object.values(personas).map((p) => p.client?.inboxId as string),
    );
    expect(group.id).toBeDefined();
  });
});
