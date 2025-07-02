import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

describe("groups", async () => {
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

  setupTestLifecycle({});

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
    it(`should remove a member from ${i}-member group and verify count`, async () => {
      const previousMembers = await groupsBySize[i].members();
      await (groupsBySize[i] as Group).removeMembers([
        previousMembers.filter(
          (member) =>
            member.inboxId !== (groupsBySize[i] as Group).addedByInboxId,
        )[0].inboxId,
      ]);

      const members = await groupsBySize[i].members();
      expect(members.length).toBe(previousMembers.length - 1);
    });
    it(`should send message to group with ${i} participants`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await groupsBySize[i].send(groupMessage);
      expect(groupMessage).toBeDefined();
    });
    it(`should verify message delivery streams for ${i}-member group`, async () => {
      console.log(
        `Creating test group with ${workers.getAll().length} worker participants`,
      );

      const testGroup = await workers.createGroupBetweenAll();

      // Start message streams for group tests
      workers.getAll().forEach((worker) => {
        worker.worker.startStream(typeofStream.Message);
      });
      console.log(`Test group created with ID: ${testGroup.id}`);

      const verifyResult = await verifyMessageStream(
        testGroup,
        workers.getAllButCreator(),
      );

      expect(verifyResult.allReceived).toBe(true);
    });
  }
});
