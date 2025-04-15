import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = ["47", "100", "105", "200"];
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  for (const version of versions) {
    it(`Shoudl keep the DB after upgrade from ${version}`, async () => {
      workers = await getWorkers(["bob-" + "a" + "-" + version], testName);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const bob = workers.get("bob");
      const inboxId = generatedInboxes[0].inboxId;
      console.log("inboxId", inboxId);
      let convo;
      if (version === "47") {
        // @ts-expect-error: SDK version compatibility issues
        convo = await bob?.client.conversations.newDmByInboxId(inboxId);
      } else {
        convo = await bob?.client.conversations.newDm(inboxId);
      }
      expect(convo?.id).toBeDefined();
    });
  }
});
