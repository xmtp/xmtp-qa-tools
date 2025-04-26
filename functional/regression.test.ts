import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { verifyStreamAll } from "@helpers/streams";
import { defaultNames, sdkVersionOptions } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions;
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create a group conversation with all workers", async () => {
    let names = defaultNames.slice(0, versions.length);
    let count = 0;
    let allNames = [];
    for (const version of versions.reverse()) {
      allNames.push(names[count] + "-b-" + version);
      count++;
    }
    console.log("names", allNames);
    workers = await getWorkers(allNames, testName);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const allWorkers = workers.getWorkers();
    const creator = allWorkers[0];
    const inboxIds = allWorkers
      .map((worker) => worker.inboxId)
      .filter((inboxId) => inboxId !== creator?.inboxId);
    console.log("inboxIds", inboxIds.length);
    const group = await creator?.client.conversations.newGroup(inboxIds);
    console.log(`Group created with id ${group?.id}`);

    const verifyResult = await verifyStreamAll(group, workers);
    if (verifyResult.messages.length !== versions.length) {
      console.log("messages", verifyResult.messages.length);
    }
  });
  //sd
  it(`Shoudl test the DB after upgrade`, async () => {
    for (const version of versions) {
      workers = await getWorkers(["bob-" + "a" + "-" + version], testName);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const bob = workers.get("bob");
      const inboxId = generatedInboxes[0].inboxId;
      console.log("Upgraded to ", version);
      let convo;
      if (version === "47") {
        // @ts-expect-error: SDK version compatibility issues
        convo = await bob?.client.conversations.newDmByInboxId(inboxId);
      } else {
        convo = await bob?.client.conversations.newDm(inboxId);
      }
      expect(convo?.id).toBeDefined();
    }
  });
  it(`Shoudl test the DB after downgrade`, async () => {
    for (const version of versions.reverse()) {
      workers = await getWorkers(["bob-" + "a" + "-" + version], testName);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const bob = workers.get("bob");
      const inboxId = generatedInboxes[0].inboxId;
      console.log("Downgraded to ", version);
      let convo;
      if (version === "47") {
        // @ts-expect-error: SDK version compatibility issues
        convo = await bob?.client.conversations.newDmByInboxId(inboxId);
      } else {
        convo = await bob?.client.conversations.newDm(inboxId);
      }
      expect(convo?.id).toBeDefined();
    }
  });
});
