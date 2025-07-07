import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getAutoVersions } from "@workers/versions";
import { describe, expect, it } from "vitest";

describe("regression", () => {
  let workers: WorkerManager;
  //limit to 2 versions for testing
  const versions = getAutoVersions().slice(0, 3);
  const receiverInboxId = getInboxIds(1)[0];

  for (const version of versions) {
    it(`downgrade to ${version.nodeVersion}`, async () => {
      workers = await getWorkers(["bob-" + "a" + "-" + version.nodeVersion], {
        useVersions: false,
      });

      const bob = workers.get("bob");
      console.log("Downgraded to ", "sdk:" + String(bob?.sdk));
      let convo = await bob?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
    });
  }
  for (const version of versions.reverse()) {
    it(`upgrade to ${version.nodeVersion}`, async () => {
      workers = await getWorkers(["alice-" + "a" + "-" + version.nodeVersion], {
        useVersions: false,
      });

      const alice = workers.get("alice");
      console.log("Upgraded to ", "sdk:" + String(alice?.sdk));
      let convo = await alice?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
    });
  }
});
