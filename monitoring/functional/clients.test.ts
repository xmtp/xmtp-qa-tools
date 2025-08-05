import { setupDurationTracking } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  setupDurationTracking({ testName });
  let workers: WorkerManager;

  it(`downgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getRandomInboxIds(1)[0];

    for (const version of versions) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const name = "downgrade";
      console.log("starting downgrade to", version.nodeSDK);
      const versionWorkers = await getWorkers([name], {
        nodeSDK: version.nodeSDK,
      });

      const filteredWorker = versionWorkers.get(name);
      let convo =
        await filteredWorker?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Downgrading to version", version.nodeSDK);
      console.log("Downgraded to ", "sdk:" + String(filteredWorker?.sdk));
    }
  });

  it(`upgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getRandomInboxIds(1)[0];

    for (const version of versions.reverse()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const name = "upgrade";
      console.log("starting upgrade to", version.nodeSDK);
      const versionWorkers = await getWorkers([name], {
        nodeSDK: version.nodeSDK,
      });

      const filteredWorker = versionWorkers.get(name);
      let convo =
        await filteredWorker?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Upgrading to version", version.nodeSDK);
      console.log("Upgraded to ", "sdk:" + String(filteredWorker?.sdk));
    }
  });
  it("track epoch changes during group operations", async () => {
    workers = await getWorkers(5);

    const group = await workers.createGroupBetweenAll();
    const initialDebugInfo = await group.debugInfo();
    const initialEpoch = initialDebugInfo.epoch;

    // Perform group operation that should increment epoch
    const newMember = getRandomInboxIds(1)[0];
    await group.addMembers([newMember]);
    // Get updated debug info
    const updatedDebugInfo = await group.debugInfo();
    console.log("updatedEpoch", updatedDebugInfo.epoch);
    expect(updatedDebugInfo.epoch).toBe(initialEpoch + 1n);
  });
});
