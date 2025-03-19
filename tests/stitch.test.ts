import { closeEnv, loadEnv } from "@helpers/client";
import { type Client } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;
  let webInboxId =
    "7291f1082bc8da64d0c78495408634f3cbd62e6b32da2b5d31d5e75c03f4e1b2";
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(["ivy"], testName);
    const ivy = workers.get("ivy");
    client = ivy?.client as Client;
    await client.conversations.syncAll();
    const newConvo = await client.conversations.newDm(webInboxId);
    const message = "gm from ivy-a " + newConvo?.id;
    console.log(message);
    await newConvo?.send(message);

    const initialConvos = await client.conversations.listDms();
    if (initialConvos.length > 0) {
      console.warn("Ivy  terminates, deletes local data, and restarts");
      ivy?.worker.clearDB();
    } else {
      const newConvo = await client.conversations.newDm(webInboxId);
      const message = "gm from ivy-a " + newConvo?.id;
      console.log(message);
      await newConvo?.send(message);
    }
  });
});
