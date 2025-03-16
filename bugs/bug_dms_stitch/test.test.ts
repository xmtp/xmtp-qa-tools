import { closeEnv, loadEnv } from "@helpers/client";
import { type Client } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "bug_dms_stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;
  let destinationInboxId =
    "45aeedf9b01400ca72c426a725c8960140d73b9a0aba7eb8c7c45e7cef524c1f";
  //ebb1d57a3bf5080e70bfd9dd69372c012ca4a95e175f6b9dacae1df4844abe04
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(["ivy"], testName);
    const ivy = workers.get("ivy");
    client = ivy?.client as Client;
    await client.conversations.syncAll();
    const newConvo = await client.conversations.newDm(destinationInboxId);
    const message = "gm from ivy-a " + newConvo?.id;
    console.log(message);
    await newConvo?.send(message);

    const initialConvos = await client.conversations.listDms();
    if (initialConvos.length > 0) {
      console.warn("Ivy  terminates, deletes local data, and restarts");
      ivy?.worker.clearDB();
    } else {
      const newConvo = await client.conversations.newDm(destinationInboxId);
      const message = "gm from ivy-a " + newConvo?.id;
      console.log(message);
      await newConvo?.send(message);
    }
  });
});
