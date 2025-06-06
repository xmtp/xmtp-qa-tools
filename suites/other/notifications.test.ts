import { loadEnv } from "@helpers/client";
import { getManualUsers } from "@helpers/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Conversation, Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

const testName = "notifications";
loadEnv(testName);
const receiverObj = getManualUsers(["fabri-convos-dev"])[0];
const receiverInboxId = receiverObj.inboxId;

describe(testName, () => {
  let group: Conversation;
  let workers: WorkerManager;

  it(`should create a group with ${receiverObj.name} members`, async () => {
    workers = await getWorkers(
      ["alice", "bob", "sam", "walt", "tina"],
      testName,
      typeofStream.Message,
      typeOfResponse.Gm,
      typeOfSync.None,
      receiverObj.network as "production" | "dev" | "local",
    );
    group = await workers.createGroup();
    if (!group) {
      console.error(`Failed to create conversation for alice`);
      return;
    }
    await (group as Group).addMembers([receiverInboxId]);
    await (group as Group).addSuperAdmin(receiverInboxId);
    console.debug("added super admin", receiverInboxId);
    await group.sync();
    await group.send("Start group test");
    console.log(`Created group ${group.id}`);
  });

  it(`should send messages to ${receiverInboxId}`, async () => {
    try {
      let counter = 0;
      console.log(`Starting notification test with random delays...`);
      for (const worker of workers.getAll()) {
        const client = worker.client;
        const conversation = await client?.conversations.newDm(receiverInboxId);
        for (let i = 0; i < 5; i++) {
          await conversation?.send(`Sending message ${i}-${counter}!`);
        }
      }
    } catch (e: unknown) {
      console.error("Test error:", e);
      throw e;
    }
  });

  it(`should send messages to ${receiverObj.inboxId}`, async () => {
    try {
      let counter = 0;

      if (!group) {
        console.error(`Failed to create conversation for alice`);
        return;
      }
      console.log(`Created group ${group.id}`);

      for (const worker of workers.getAllButCreator()) {
        const client = worker.client;
        await client?.conversations.sync();
        const conversation = await client?.conversations.getConversationById(
          group.id,
        );

        if (conversation) {
          for (let i = 0; i < 5; i++) {
            await conversation.send(
              `Second message ${i}-${counter}, ${worker.name}!`,
            );
          }
        }
        counter++;
      }
    } catch (e: unknown) {
      console.error("Test error:", e);
      throw e;
    }
  });
});
