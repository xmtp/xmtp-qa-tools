import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { defaultNames, getInboxIds, sdkVersionOptions } from "@helpers/tests";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions;
  const receiverInboxId = getInboxIds(1);

  it("should create a group conversation with all workers", async () => {
    try {
      let names = defaultNames.slice(0, versions.length);
      let count = 0;
      let allNames = [];
      for (const version of versions.reverse()) {
        allNames.push(names[count] + "-b-" + version);
        count++;
      }
      workers = await getWorkers(allNames, testName, typeofStream.Message);
      const creator = workers.getCreator();
      const group = await creator.client.conversations.newGroup([]);

      for (const worker of workers.getAllButCreator()) {
        try {
          await group.addMembers([worker.client.inboxId]);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
        }
      }
      const members = await group.members();
      console.log(
        "Group created with id",
        group?.id,
        "and members",
        members.length,
      );
      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it(`Should test the DB after upgrade`, async () => {
    try {
      for (const version of versions) {
        workers = await getWorkers(["bob-" + "a" + "-" + version], testName);

        const bob = workers.get("bob");
        console.log(
          "Upgraded to",
          "node-sdk:" + String(bob?.sdkVersion),
          "node-bindings:" + String(bob?.libXmtpVersion),
        );
        let convo = await bob?.client.conversations.newDm(receiverInboxId[0]);

        expect(convo?.id).toBeDefined();
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

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
        let convo = await bob?.client.conversations.newDm(receiverInboxId[0]);

        expect(convo?.id).toBeDefined();
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
