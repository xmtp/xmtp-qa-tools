import { loadEnv } from "@helpers/client";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, it } from "vitest";
import receivers from "./receivers.json";

const testName = "ts_notifications";
loadEnv(testName);

describe(testName, async () => {
  for (const receiver of receivers.filter((r) => r.network === "dev")) {
    console.log(JSON.stringify(receiver, null, 2));
    let workers = await getWorkers(
      ["alice", "bob", "sam", "walt", "tina"],
      testName,
      typeofStream.None,
      typeOfResponse.None,
      receiver.network as "production" | "dev" | "local",
    );
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
          await conversation?.send(`Hello ${messageCounter}!`);
          messageCounter++;
        }
      } catch (e: unknown) {
        console.error("Test error:", e);
        throw e;
      }
    });

    it(`should create a group with ${workers.getAllButCreator().length} members with random delays between 3-6 seconds`, async () => {
      try {
        if (!receiver.groupId) {
          const client = workers.getCreator()?.client;
          const group = await client?.conversations.newGroup([
            ...workers.getAllButCreator().map((w) => w.inboxId),
            receiver.inboxId,
          ]);
          if (!group) {
            console.error(`Failed to create conversation for alice`);
            return;
          }
          console.log(`Created group ${group.id}`);
          receiver.groupId = group.id;
        }
        let counter = 0;
        for (const worker of workers.getAllButCreator()) {
          const client = worker.client;
          await client?.conversations.sync();
          const conversation = await client?.conversations.getConversationById(
            receiver.groupId,
          );
          if (!conversation) {
            console.error(`Failed to create conversation for ${worker.name}`);
            return;
          }
          await conversation.send(`Hello ${counter}, ${worker.name}!`);
          counter++;
        }
      } catch (e: unknown) {
        console.error("Test error:", e);
        throw e;
      }
    });
  }
});
