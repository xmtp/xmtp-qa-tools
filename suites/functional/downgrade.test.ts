import { sdkVersionOptions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "downgrade";

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions;
  const receiverInboxId = getInboxIds(1)[0];

  it("should maintain database integrity and functionality when downgrading across SDK versions", async () => {
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
});
