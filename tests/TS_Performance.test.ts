import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceMetric, sendTestResults } from "@helpers/datadog";
import generatedInboxes from "@helpers/generated-inboxes.json";
import type { Conversation, Group, Persona } from "@helpers/types";
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
  let dm: Conversation;
  let group: Conversation;
  let personas: Record<string, Persona>;
  let start: number;
  let hasFailures: boolean = false;
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
      console.timeEnd(testName);
      void sendPerformanceMetric(
        performance.now() - start,
        testName,
        Object.values(personas)[0].version,
      );
    }
  });

  afterAll(async () => {
    sendTestResults(hasFailures ? "failure" : "success", testName);
    await closeEnv(testName, personas);
  });

  it("inboxState: should measure inboxState of henry", async () => {
    try {
      const inboxState = await personas.henry.client?.inboxState(true);
      expect(inboxState?.installations.length).toBeGreaterThan(0);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });
  it("createDM: should measure creating a DM", async () => {
    try {
      dm = await personas.henry.client!.conversations.newDm(
        personas.randomguy.client!.accountAddress,
      );

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("sendGM: should measure sending a gm", async () => {
    try {
      // We'll expect this random message to appear in Joe's stream
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${personas.henry.name}] Creating DM with ${personas.randomguy.name} at ${personas.randomguy.client?.accountAddress}`,
      );

      const dmId = await dm.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const verifyResult = await verifyStream(dm, [personas.randomguy]);

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("createGroup: should measure creating a group", async () => {
    try {
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
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    try {
      const groupByInboxIds =
        await personas.henry.client!.conversations.newGroupByInboxIds([
          personas.ivy.client!.inboxId,
          personas.jack.client!.inboxId,
          personas.karen.client!.inboxId,
        ]);

      console.log("Henry's groupByInboxIds", groupByInboxIds.id);
      expect(groupByInboxIds.id).toBeDefined();
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("updateGroupName: should create a group and update group name", async () => {
    try {
      const result = await verifyStream(
        group,
        [personas.nancy],
        "group_updated",
      );
      expect(result.allReceived).toBe(true);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("addMembers: should measure adding a participant to a group", async () => {
    try {
      await (group as Group).addMembers([
        personas.randomguy.client!.accountAddress as `0x${string}`,
      ]);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });
  it("syncGroup: should measure syncing a group", async () => {
    try {
      await group.sync();
      await group.members();
    } catch (e) {
      console.error("[vitest]   Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("removeMembers: should remove a participant from a group", async () => {
    try {
      const previousMembers = await group.members();
      await (group as Group).removeMembers([
        personas.nancy.client!.accountAddress as `0x${string}`,
      ]);
      const members = await group.members();
      expect(members.length).toBe(previousMembers.length - 1);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("sendGroupMessage: should measure sending a gm in a group", async () => {
    try {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await group.send(groupMessage);
      console.log("GM Message sent in group", groupMessage);
      expect(groupMessage).toBeDefined();
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });

  it("receiveGroupMessage: should create a group and measure all streams", async () => {
    try {
      const verifyResult = await verifyStreamAll(group, personas);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      console.error("[vitest] Test failed", (e as Error).message);
      hasFailures = true;
    }
  });
  for (let i = batchSize; i <= total; i += batchSize) {
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = generatedInboxes.slice(0, i);
        group = await personas.henry.client!.conversations.newGroupByInboxIds(
          sliced.map((inbox) => inbox.inboxId),
        );
        expect(group.id).toBeDefined();
      } catch (e) {
        console.error("[vitest] Test failed", (e as Error).message);
        hasFailures = true;
      }
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      try {
        await group.sync();
        const members = await group.members();
        expect(members.length).toBe(i + 1);
      } catch (e) {
        console.error("[vitest] Test failed", (e as Error).message);
        hasFailures = true;
      }
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      try {
        await (group as Group).updateName("Large Group");
        expect((group as Group).name).toBe("Large Group");
      } catch (e) {
        console.error("[vitest] Test failed", (e as Error).message);
        hasFailures = true;
      }
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      try {
        const previousMembers = await group.members();
        await (group as Group).removeMembers([
          previousMembers[previousMembers.length - 1]
            .accountAddresses[0] as `0x${string}`,
        ]);
        const members = await group.members();
        expect(members.length).toBe(previousMembers.length - 1);
      } catch (e) {
        console.error("[vitest] Test failed", (e as Error).message);
        hasFailures = true;
      }
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      try {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        await group.send(groupMessage);
        console.log("GM Message sent in group", groupMessage);
        expect(groupMessage).toBeDefined();
      } catch (e) {
        console.error("[vitest] Test failed", (e as Error).message);
        hasFailures = true;
      }
    });
  }
});
