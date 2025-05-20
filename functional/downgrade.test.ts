import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/inboxes.json";
import { logError } from "@helpers/logger";
import { sdkVersionOptions } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions; //["202", "203", "204", "205", "206", "208", "209", "210"];
  const receiverInboxId = generatedInboxes[0].inboxId;

  it(`Should test the DB after downgrade`, async () => {
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
