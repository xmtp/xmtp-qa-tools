import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions, type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, async () => {
  setupTestLifecycle({ testName });
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

  it("stitching", async () => {
    workers = await getWorkers(["randombob-a", "alice"]);
    let creator = workers.get("randombob", "a")!;
    const receiver = workers.get("alice")!;
    let dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultFirstDm = await verifyMessageStream(dm, [receiver]);
    expect(resultFirstDm.allReceived).toBe(true);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultSecondDm = await verifyMessageStream(dm, [receiver]);
    expect(resultSecondDm.allReceived).toBe(false);
  });

  it("installations", async () => {
    const baseName = "randomguy";

    // Create primary installation
    const primary = await getWorkers([baseName]);

    // Create secondary installation with different folder
    const secondary = await getWorkers([baseName + "-desktop"]);

    // Get workers with correct base name and installation IDs
    const primaryWorker = primary.get(baseName);
    const secondaryWorker = secondary.get(baseName, "desktop");

    // Ensure workers exist
    expect(primaryWorker).toBeDefined();
    expect(secondaryWorker).toBeDefined();

    // shared identity but separate storage
    expect(primaryWorker?.client.inboxId).toBe(secondaryWorker?.client.inboxId);
    expect(primaryWorker?.dbPath).not.toBe(secondaryWorker?.dbPath);
  });
});
