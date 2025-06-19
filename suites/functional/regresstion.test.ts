import { sdkVersionOptions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "regression";
describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions.slice(0, 3).reverse();
  const receiverInboxId = getInboxIds(1)[0];

  it(`downgrade ${versions.join(",")}`, async () => {
    try {
      for (const version of versions.reverse()) {
        workers = await getWorkers(["bob-" + "a" + "-" + version], testName);

        const bob = workers.get("bob");
        console.log(
          "Downgraded to ",
          "node-sdk:" + String(bob?.sdkVersion),
          "node-bindings:" + String(bob?.libXmtpVersion),
        );
        let convo = await bob?.client.conversations.newDm(receiverInboxId);

        expect(convo?.id).toBeDefined();
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it(`upgrade ${versions.join(",")}`, async () => {
    try {
      for (const version of versions) {
        workers = await getWorkers(["alice-" + "a" + "-" + version], testName);

        const alice = workers.get("alice");
        console.log(
          "Upgraded to ",
          "node-sdk:" + String(alice?.sdkVersion),
          "node-bindings:" + String(alice?.libXmtpVersion),
        );
        let convo = await alice?.client.conversations.newDm(receiverInboxId);

        expect(convo?.id).toBeDefined();
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
