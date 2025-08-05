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
      console.log(name);
      const versionWorkers = await getWorkers([name], {
        nodeSDK: version.nodeSDK,
      });

      // When useVersions is false, the worker name doesn't include the version
      // So we need to get it by the base name without the version
      const baseName = name.split("-")[0]; // "upgrade"
      console.log("baseName", baseName);
      const filteredWorker = versionWorkers.get(baseName);
      console.log("Found downgrade worker:", filteredWorker ? "yes" : "no");
      console.log("Downgraded to ", "sdk:" + String(filteredWorker?.sdk));
      let convo =
        await filteredWorker?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Dowgrading from version", version.nodeSDK);
    }
  });

  it(`upgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getRandomInboxIds(1)[0];

    for (const version of versions.reverse()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const name = "upgrade-" + "a" + "-" + version.nodeSDK;
      const versionWorkers = await getWorkers([name], {
        useVersions: false,
      });

      // When useVersions is false, the worker name doesn't include the version
      // So we need to get it by the base name without the version
      const baseName = name.split("-")[0]; // "upgrade"
      const filteredWorker = versionWorkers.get(baseName);
      console.log("Found downgrade worker:", filteredWorker ? "yes" : "no");
      console.log("Downgraded to ", "sdk:" + String(filteredWorker?.sdk));
      let convo =
        await filteredWorker?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Dowgrading from version", version.nodeSDK);
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
