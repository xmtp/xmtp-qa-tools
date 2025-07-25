import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "@workers/versions";
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
      const versionWorkers = await getWorkers(
        ["downgrade-" + "a" + "-" + version.nodeVersion],
        {
          useVersions: false,
        },
      );

      const downgrade = versionWorkers.get("downgrade");
      console.log("Downgraded to ", "sdk:" + String(downgrade?.sdk));
      let convo = await downgrade?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
      if (!convo?.id)
        console.error("Dowgrading from version", version.nodeVersion);
    }
  });

  it(`upgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getInboxIds(1)[0];

    for (const version of versions.reverse()) {
      const versionWorkers = await getWorkers(
        ["upgrade-" + "a" + "-" + version.nodeVersion],
        {
          useVersions: false,
        },
      );

      const upgrade = versionWorkers.get("upgrade");
      console.log("Upgraded to ", "sdk:" + String(upgrade?.sdk));
      let convo = await upgrade?.client.conversations.newDm(receiverInboxId);
      expect(convo?.id).toBeDefined();
      if (!convo?.id)
        console.error("Upgrading to version", version.nodeVersion);
    }
  });

  it("validation and key package status", async () => {
    const inboxState = await workers
      .get("henry")!
      .client.preferences.inboxState(true);
    expect(inboxState.installations.length).toBeGreaterThan(0);

    // Retrieve all the installation ids for the target
    const installationIds = inboxState.installations.map(
      (installation) => installation.id,
    );

    // Retrieve a map of installation id to KeyPackageStatus
    const status = await workers
      .get("henry")!
      .client.getKeyPackageStatusesForInstallationIds(installationIds);

    // Count valid and invalid installations
    const totalInstallations = Object.keys(status).length;
    const validInstallations = Object.values(status).filter(
      (value) => !value?.validationError,
    ).length;
    const invalidInstallations = totalInstallations - validInstallations;
    console.log(
      `Valid installations: ${validInstallations}, Invalid installations: ${invalidInstallations}`,
    );
  });

  it("inbox state from external inbox IDs", async () => {
    const bobInboxId = workers.get("bob")!.client.inboxId;
    const inboxState = await workers
      .get("henry")!
      .client.preferences.inboxStateFromInboxIds([bobInboxId], true);
    console.log(inboxState[0].inboxId);
    expect(inboxState[0].inboxId).toBe(bobInboxId);
  });

  it("shared identity and separate storage", async () => {
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

    // Verify shared identity but separate storage
    expect(primaryWorker?.client.inboxId).toBe(secondaryWorker?.client.inboxId);
    expect(primaryWorker?.dbPath).not.toBe(secondaryWorker?.dbPath);
  });
});
