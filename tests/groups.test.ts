import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { type Conversation, type Group, type Persona } from "@helpers/types";
import { verifyStream, verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "groups";
loadEnv(testName);
describe(testName, () => {
  let personas: Record<string, Persona>;
  let group: Conversation;
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

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("createGroup: should measure creating a group", async () => {
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
    expect(group.id).toBeDefined();
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
    const result = await verifyStream(group, [personas.nancy], "group_updated");
    expect(result.allReceived).toBe(true);
  });

  it("addMembers: should measure adding a participant to a group", async () => {
    await (group as Group).addMembers([
      personas.randomguy.client!.accountAddress as `0x${string}`,
    ]);
  });
  it("syncGroup: should measure syncing a group", async () => {
    await group.sync();
    await group.members();
  });

  it("removeMembers: should remove a participant from a group", async () => {
    const previousMembers = await group.members();
    await (group as Group).removeMembers([
      personas.nancy.client!.accountAddress as `0x${string}`,
    ]);
    const members = await group.members();
    expect(members.length).toBe(previousMembers.length - 1);
  });

  it("sendGroupMessage: should measure sending a gm in a group", async () => {
    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

    await group.send(groupMessage);
    console.log("GM Message sent in group", groupMessage);
    expect(groupMessage).toBeDefined();
  });

  it("receiveGroupMessage: should create a group and measure all streams", async () => {
    const verifyResult = await verifyStreamAll(group, personas);
    expect(verifyResult.allReceived).toBe(true);
  });
  for (let i = batchSize; i <= total; i += batchSize) {
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      const sliced = generatedInboxes.slice(0, i);
      group = await personas.henry.client!.conversations.newGroupByInboxIds(
        sliced.map((inbox) => inbox.inboxId),
      );
      expect(group.id).toBeDefined();
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      await group.sync();
      const members = await group.members();
      expect(members.length).toBe(i + 1);
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      await (group as Group).updateName("Large Group");
      expect((group as Group).name).toBe("Large Group");
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      const previousMembers = await group.members();
      const randomMember =
        previousMembers[Math.floor(Math.random() * previousMembers.length)];
      await (group as Group).removeMembers([
        randomMember.accountAddresses[0] as `0x${string}`,
      ]);

      const members = await group.members();
      expect(members.length).toBe(previousMembers.length - 1);
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await group.send(groupMessage);
      console.log("GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    });
  }
});
