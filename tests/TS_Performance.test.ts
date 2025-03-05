import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceMetric } from "@helpers/datadog";
import generatedInboxes from "@helpers/generated-inboxes.json";
import type { Conversation, Persona } from "@helpers/types";
import { verifyStream, verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "ts_performance";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;
  const batchSize = parseInt(process.env.BATCH_SIZE ?? "5");
  const total = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

  beforeAll(async () => {
    personas = await getWorkers(
      [
        "henry",
        "ivy",
        "jack",
        "karen",
        "randomguy",
        "larry",
        "mary",
        "nancy",
        "oscar",
      ],
      testName,
    );
  });
  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName;
    if (testName) {
      void sendPerformanceMetric(
        performance.now() - start,
        testName,
        Object.values(personas)[0].version,
      );
      console.timeEnd(testName);
    }
  });
  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("inboxState: should measure inboxState of henry", async () => {
    const inboxState = await personas.henry.client?.inboxState(true);
    console.log(inboxState?.installations.length);
  });
  it("createDM: should measure creating a DM", async () => {
    convo = await personas.henry.client!.conversations.newDm(
      personas.randomguy.client!.accountAddress,
    );

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("sendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas.henry.name}] Creating DM with ${personas.randomguy.name} at ${personas.randomguy.client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("receiveGM: should measure receiving a gm", async () => {
    const verifyResult = await verifyStream(convo, [personas.randomguy]);

    expect(verifyResult.messages.length).toEqual(1);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("createGroup: should measure creating a group", async () => {
    convo = await personas.henry.client!.conversations.newGroup([
      personas.ivy.client!.accountAddress as `0x${string}`,
      personas.jack.client!.accountAddress as `0x${string}`,
      personas.karen.client!.accountAddress as `0x${string}`,
      personas.nancy.client!.accountAddress as `0x${string}`,
      personas.oscar.client!.accountAddress as `0x${string}`,
      personas.mary.client!.accountAddress as `0x${string}`,
      personas.larry.client!.accountAddress as `0x${string}`,
    ]);
    console.log("Henry's group", convo.id);
    expect(convo.id).toBeDefined();
  });

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const groupByInboxIds =
      await personas.henry.client!.conversations.newGroupByInboxIds([
        personas.ivy.client!.inboxId,
        personas.jack.client!.inboxId,
        personas.karen.client!.inboxId,
      ]);

    console.log("Henry's groupByInboxIds", groupByInboxIds.id);
    expect(groupByInboxIds.id).toBeDefined();
  });

  it("updateGroupName: should create a group and update group name", async () => {
    const result = await verifyStream(convo, [personas.nancy], "group_updated");
    expect(result.allReceived).toBe(true);
  });

  it("addMembers: should measure adding a participant to a group", async () => {
    await convo.addMembers([
      personas.randomguy.client!.accountAddress as `0x${string}`,
    ]);
  });
  it("syncGroup: should measure syncing a group", async () => {
    await convo.sync();
    await convo.members();
  });

  it("removeMembers: should remove a participant from a group", async () => {
    const previousMembers = await convo.members();
    await convo.removeMembers([
      personas.nancy.client!.accountAddress as `0x${string}`,
    ]);
    const members = await convo.members();
    expect(members.length).toBe(previousMembers.length - 1);
  });

  it("sendGroupMessage: should measure sending a gm in a group", async () => {
    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

    await convo.send(groupMessage);
    console.log("GM Message sent in group", groupMessage);
    expect(groupMessage).toBeDefined();
  });

  it("receiveGroupMessage: should create a group and measure all streams", async () => {
    const verifyResult = await verifyStreamAll(convo, personas);
    expect(verifyResult.allReceived).toBe(true);
  });
  for (let i = batchSize; i <= total; i += batchSize) {
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      const sliced = generatedInboxes.slice(0, i);
      convo = await personas.henry.client!.conversations.newGroupByInboxIds(
        sliced.map((inbox) => inbox.inboxId),
      );
      expect(convo.id).toBeDefined();
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      await convo.sync();
      const members = await convo.members();
      expect(members.length).toBe(i + 1);
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      await convo.updateName("Large Group");
      expect(convo.name).toBe("Large Group");
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await convo.send(groupMessage);
      console.log("GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    });
  }
});
