import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = ["100", "105", "200"];
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  for (const version of versions) {
    it(`Shoudl keep the DB after upgrade from ${version}`, async () => {
      workers = await getWorkers(["bob-" + "a" + "-" + version], testName);
      const bob = workers.get("bob", version);
      const inboxId = generatedInboxes[0].inboxId;
      console.log("inboxId", inboxId);
      const convo = await bob?.client.conversations.newDm(inboxId);
      if (version === "30" || version === "47") {
        expect(convo?.id).toBeUndefined();
      } else {
        expect(convo?.id).toBeDefined();
      }
    });
  }
});
