import { loadEnv } from "@helpers/client";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Conversation } from "@xmtp/node-sdk";
import { describe, it } from "vitest";
import receivers from "./receivers.json";

const testName = "ts_notifications";
loadEnv(testName);

describe(testName, () => {
  let group: Conversation;
  let workers: WorkerManager;
  for (const receiver of receivers.filter((r) => r.network === "dev")) {
    it(`should create a group with ${receiver.name} members`, async () => {
      console.log(JSON.stringify(receiver, null, 2));
      workers = await getWorkers(
        ["alice", "bob", "sam", "walt", "tina"],
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
        receiver.network as "production" | "dev" | "local",
      );
      group = await workers.createGroup();
      if (!group) {
        console.error(`Failed to create conversation for alice`);
        return;
      }
      await group.send("Start group test");
      console.log(`Created group ${group.id}`);
    });

    it(`should send messages to ${receiver.inboxId} with random delays between 3-6 seconds`, async () => {
      try {
        console.log(`Starting notification test with random delays...`);
        let messageCounter = 0;
        for (const worker of workers.getWorkers()) {
          const client = worker.client;
          const conversation = await client?.conversations.newDm(
            receiver.inboxId,
          );
          await conversation?.send(`Sending message ${messageCounter}!`);
          messageCounter++;
        }
      } catch (e: unknown) {
        console.error("Test error:", e);
        throw e;
      }
    });

    it(`should send messages to ${receiver.inboxId} with random delays between 3-6 seconds`, async () => {
      try {
        let counter = 0;
        for (const worker of workers.getAllButCreator()) {
          const client = worker.client;
          await client?.conversations.sync();
          const conversation = await client?.conversations.getConversationById(
            group.id,
          );
          if (conversation) {
            await conversation.send(
              `Second message ${counter}, ${worker.name}!`,
            );
            return;
          }
          counter++;
        }
      } catch (e: unknown) {
        console.error("Test error:", e);
        throw e;
      }
    });
  }
});
