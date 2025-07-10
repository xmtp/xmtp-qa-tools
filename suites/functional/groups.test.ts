import { verifyConversationStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "groups";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers: WorkerManager;
  workers = await getWorkers([
    "henry",
    "ivy",
    "jack",
    "karen",
    "randomguy",
    "larry",
    "mary",
    "nancy",
    "oscar",
  ]);
  const batchSize = 5;
  const total = 10;

  // Create a mapping to store group conversations by size
  const groupsBySize: Record<number, Conversation> = {};

  for (let i = batchSize; i <= total; i += batchSize) {
    it(`should create a group with ${i} participants`, async () => {
      const sliced = getInboxIds(i);
      console.log("Creating group with", sliced.length, "participants");
      groupsBySize[i] = (await workers
        .getCreator()
        .client.conversations.newGroup(sliced)) as Group;
      console.log("Group created", groupsBySize[i].id);
      expect(groupsBySize[i].id).toBeDefined();
    });
    it(`should sync group with ${i} participants and verify member count`, async () => {
      await groupsBySize[i].sync();
      const members = await groupsBySize[i].members();
      expect(members.length).toBe(i + 1);
    });
    it(`should update group name for ${i}-member group`, async () => {
      const newName = "Large Group";
      await (groupsBySize[i] as Group).updateName(newName);
      await groupsBySize[i].sync();
      const name = (groupsBySize[i] as Group).name;
      expect(name).toBe(newName);
    });
    it(`should verify new conversation stream for ${i}-member group`, async () => {
      // Use the dedicated conversation stream verification helper
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );
      expect(verifyResult.allReceived).toBe(true);
    });
  }
});
