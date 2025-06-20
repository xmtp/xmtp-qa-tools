import { sdkVersionOptions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "regression";
describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions.reverse().slice(0, 3);
  const receiverInboxId = getInboxIds(1)[0];

  for (const version of versions) {
    it(`downgrade to ${version}`, async () => {
      try {
        workers = await getWorkers(["bob-" + "a" + "-" + version], testName);

        const bob = workers.get("bob");
        console.log(
          "Downgraded to ",
          "node-sdk:" + String(bob?.sdkVersion),
          "node-bindings:" + String(bob?.libXmtpVersion),
        );
        let convo = await bob?.client.conversations.newDm(receiverInboxId);

        expect(convo?.id).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
  for (const version of versions.reverse()) {
    it(`upgrade to ${version}`, async () => {
      try {
        workers = await getWorkers(["alice-" + "a" + "-" + version], testName);

        const alice = workers.get("alice");
        console.log(
          "Upgraded to ",
          "node-sdk:" + String(alice?.sdkVersion),
          "node-bindings:" + String(alice?.libXmtpVersion),
        );
        let convo = await alice?.client.conversations.newDm(receiverInboxId);

        expect(convo?.id).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
