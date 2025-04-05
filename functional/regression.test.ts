import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("Shoudl keep the DB after upgrade", async () => {
    workers = await getWorkers(["bob-a-47"], testName);
    const bob = workers.get("bob", "a");
    const inboxId = generatedInboxes[0].inboxId;
    console.log("inboxId", inboxId);
    const convo = await bob?.client.conversations.newDm(inboxId);
    const messageId = await convo?.send("Hello");
    console.log("messageId", messageId);
    console.log("convo", convo?.id);
    workers = await getWorkers(["bob-a-104"], testName);
    const bob100_2 = workers.get("bob", "a");
    await bob100_2?.client.conversations.sync();
    const convo2 = await bob100_2?.client.conversations.getConversationById(
      convo?.id as string,
    );
    const messages = await convo2?.messages();
    console.log("messages", messages?.length);
  });
});
