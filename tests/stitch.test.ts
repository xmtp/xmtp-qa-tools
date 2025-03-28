import { closeEnv, loadEnv } from "@helpers/client";
import { type Client } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;
  const cbUser = process.env.CB_USER;
  const convosUser = process.env.CONVOS_USER;
  if (!cbUser || !convosUser) {
    throw new Error("CB_USER or CONVOS_USER is not set");
  }
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(["ivy"], testName);
    const ivy = workers.get("ivy");
    client = ivy?.client as Client;
    await client.conversations.syncAll();
    const newConvo = await client.conversations.newDm(convosUser);
    const message = "gm from ivy-a " + newConvo?.id;
    console.log(message);
    await newConvo?.send(message);

    const initialConvos = await client.conversations.listDms();
    if (initialConvos.length > 0) {
      console.warn("Ivy  terminates, deletes local data, and restarts");
      ivy?.worker.clearDB();
    } else {
      const newConvo = await client.conversations.newDm(convosUser);
      const message = "gm from ivy-a " + newConvo?.id;
      console.log(message);
      await newConvo?.send(message);
    }
  });
});
