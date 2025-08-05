import { setupDurationTracking } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, async () => {
  setupDurationTracking({ testName });
  let workers: WorkerManager;
  workers = await getWorkers([
    "henry",
    "ivy",
    "jack",
    "karen",
    "bob",
    "randomguy",
    "larry",
    "mary",
    "nancy",
    "oscar",
  ]);

  it(`downgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    console.log("versions", versions);
    const receiverInboxId = getRandomInboxIds(1)[0];

    for (const version of versions) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const name = "downgrade-" + "a" + "-" + version.nodeSDK;
      const versionWorkers = await getWorkers([name], {
        useVersions: false,
      });

      // When useVersions is false, the worker name doesn't include the version
      // So we need to get it by the base name without the version
      const downgrade = versionWorkers.get(name);
      console.log("Found downgrade worker:", downgrade ? "yes" : "no");
      console.log("Downgraded to ", "sdk:" + String(downgrade?.sdk));
      let convo = await downgrade?.client.conversations.newDm(receiverInboxId);

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
      const upgrade = versionWorkers.get(baseName);
      console.log("Upgraded to ", "sdk:" + String(upgrade?.sdk));
      let convo = await upgrade?.client.conversations.newDm(receiverInboxId);
      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Upgrading to version", version.nodeSDK);
    }
  });
  it("track epoch changes during group operations", async () => {
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
