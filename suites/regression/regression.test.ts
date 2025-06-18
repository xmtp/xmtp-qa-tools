import { defaultNames, sdkVersionOptions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "regression";

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions.reverse().slice(0, 3);
  const receiverInboxId = getInboxIds(1);

  it("should create group conversation with workers using different SDK versions and verify cross-version message delivery", async () => {
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
      const group = (await creator.client.conversations.newGroup([])) as Group;

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

  it("should maintain database compatibility when upgrading SDK versions sequentially from oldest to newest", async () => {
    try {
      for (const version of versions) {
        workers = await getWorkers(["bob-" + "a" + "-" + version], testName);

        const bob = workers.get("bob");
        console.warn(
          "Upgraded to",
          "node-sdk:" + String(bob?.sdkVersion),
          "node-bindings:" + String(bob?.libXmtpVersion),
        );
        let newGroup = (await bob?.client.conversations.newGroup(
          receiverInboxId,
        )) as Group;
        let members = await newGroup.members();
        console.log(
          "Group created with id",
          newGroup?.id,
          "and members",
          members.length,
        );
        let verifyResult = await verifyMessageStream(newGroup, [bob!]);
        expect(verifyResult.allReceived).toBe(true);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should maintain database compatibility when downgrading SDK versions sequentially from newest to oldest", async () => {
    try {
      for (const version of versions.reverse()) {
        workers = await getWorkers(["bob-" + "a" + "-" + version], testName);

        const bob = workers.get("bob");
        console.warn(
          "Downgraded to ",
          "node-sdk:" + String(bob?.sdkVersion),
          "node-bindings:" + String(bob?.libXmtpVersion),
        );
        let newGroup = (await bob?.client.conversations.newGroup(
          receiverInboxId,
        )) as Group;
        let members = await newGroup.members();
        console.log(
          "Group created with id",
          newGroup?.id,
          "and members",
          members.length,
        );
        let verifyResult = await verifyMessageStream(newGroup, [bob!]);
        expect(verifyResult.allReceived).toBe(true);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
