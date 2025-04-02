import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(
      ["ivy-a-100", "ivy-b-104", "emma-a-0047"],
      testName,
    );
    const ivy100 = workers.get("ivy", "a");
    const ivy104 = workers.get("ivy", "b");
    const emma = workers.get("emma", "a");
    console.log(
      "ivy100",
      ivy100?.version,
      "ivy104",
      ivy104?.version,
      "emma",
      emma?.version,
    );
    expect(ivy100?.version).not.toBe(ivy104?.version);
  });

  it("Shoudl keep the DB after upgrade", async () => {
    workers = await getWorkers(["emma-a-0047"], testName);
    const emma = workers.get("emma", "a");
    const convo = await emma?.client.conversations.newDm(emma.client.inboxId);
    const messageId = await convo?.send("Hello");
    console.log("messageId", messageId);

    workers = await getWorkers(["emma-b-100"], testName);
    const emma100_2 = workers.get("emma", "b");
    const convo2 = await emma100_2?.client.conversations.newDm(
      emma100_2.client.inboxId,
    );
    const messageId2 = await convo2?.send("Hello");
    console.log("messageId2", messageId2);
  });
});
