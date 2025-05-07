import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { verifyStreamAll } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/tests";
import { getWorkers } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "groups";
loadEnv(testName);
describe(testName, async () => {
  const workers = await getWorkers(
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
  const batchSize = 5;
  const total = 10;
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
  // Create a mapping to store group conversations by size
  const groupsBySize: Record<number, Conversation> = {};

  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = generatedInboxes.slice(0, i);
        console.log("Creating group with", sliced.length, "participants");
        groupsBySize[i] = await workers
          .get("henry")!
          .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
        console.log("Group created", groupsBySize[i].id);
        expect(groupsBySize[i].id).toBeDefined();
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      try {
        await groupsBySize[i].sync();
        const members = await groupsBySize[i].members();
        expect(members.length).toBe(i + 1);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      try {
        const newName = "Large Group";
        await (groupsBySize[i] as Group).updateName(newName);
        await groupsBySize[i].sync();
        const name = (groupsBySize[i] as Group).name;
        expect(name).toBe(newName);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      try {
        const previousMembers = await groupsBySize[i].members();
        await (groupsBySize[i] as Group).removeMembers([
          previousMembers.filter(
            (member) =>
              member.inboxId !== (groupsBySize[i] as Group).addedByInboxId,
          )[0].inboxId,
        ]);

        const members = await groupsBySize[i].members();
        expect(members.length).toBe(previousMembers.length - 1);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      try {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        await groupsBySize[i].send(groupMessage);
        console.log("GM Message sent in group", groupMessage);
        expect(groupMessage).toBeDefined();
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`receiveGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const verifyResult = await verifyStreamAll(
          groupsBySize[i],
          workers,
          1,
          () => {
            console.log(
              `Group message sent for ${i} participants, starting timer now`,
            );
            start = performance.now();
          },
        );
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
  }
});
