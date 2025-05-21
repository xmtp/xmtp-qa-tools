import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getInboxIds } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
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
    typeofStream.Message,
  );
  const batchSize = 5;
  const total = 10;

  // Create a mapping to store group conversations by size
  const groupsBySize: Record<number, Conversation> = {};

  setupTestLifecycle({
    expect,
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = getInboxIds(i);
        console.log("Creating group with", sliced.length, "participants");
        groupsBySize[i] = await workers
          .getCreator()
          .client.conversations.newGroup(sliced);
        console.log("Group created", groupsBySize[i].id);
        expect(groupsBySize[i].id).toBeDefined();
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      try {
        await groupsBySize[i].sync();
        const members = await groupsBySize[i].members();
        expect(members.length).toBe(i + 1);
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
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
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
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
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
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
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`receiveGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        console.log(
          `Creating test group with ${workers.getAll().length} worker participants`,
        );

        const testGroup = await workers.createGroup();

        console.log(`Test group created with ID: ${testGroup.id}`);

        const verifyResult = await verifyMessageStream(
          testGroup,
          workers.getAllButCreator(),
        );

        expect(verifyResult.allReceived).toBe(true);
      } catch (e: unknown) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
