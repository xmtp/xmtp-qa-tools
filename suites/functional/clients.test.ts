import { setupDurationTracking } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "@workers/versions";
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
    const receiverInboxId = getInboxIds(1)[0];

    for (const version of versions) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const versionWorkers = await getWorkers(
        ["downgrade-" + "a" + "-" + version.nodeSDK],
        {
          useVersions: false,
        },
      );

      const downgrade = versionWorkers.get("downgrade");
      console.log("Downgraded to ", "sdk:" + String(downgrade?.sdk));
      let convo = await downgrade?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id) console.error("Dowgrading from version", version.nodeSDK);
    }
  });

  it(`upgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getInboxIds(1)[0];

    for (const version of versions.reverse()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const versionWorkers = await getWorkers(
        ["upgrade-" + "a" + "-" + version.nodeSDK],
        {
          useVersions: false,
        },
      );

      const upgrade = versionWorkers.get("upgrade");
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
    const newMember = getInboxIds(1)[0];
    await group.addMembers([newMember]);
    // Get updated debug info
    const updatedDebugInfo = await group.debugInfo();
    console.log("updatedDebugInfo", updatedDebugInfo);
    const updatedEpoch = updatedDebugInfo.epoch;
    console.log("updatedEpoch", updatedEpoch);

    // epoch increased
    expect(updatedEpoch).toBe(initialEpoch + 1n);
  });
});
