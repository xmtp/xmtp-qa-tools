import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "@workers/versions";
import { Client, IdentifierKind, type Identifier } from "@xmtp/node-sdk";
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

  it("performance: measure XMTP client creation performance and initialization", async () => {
    const client = await getWorkers(["randomclient"]);
    expect(client).toBeDefined();
  });

  it("functionality: resolve inbox ID from Ethereum address using getInboxIdByAddress", async () => {
    const client = workers.get("henry")!.client;
    const randomAddress = workers.get("ivy")!.address;
    const inboxId = await client.getInboxIdByIdentifier({
      identifier: randomAddress,
      identifierKind: IdentifierKind.Ethereum,
    });
    console.log("installationId", client.installationId);
    expect(client.installationId).toBeDefined();
    expect(inboxId).toBeDefined();
  });

  it("functionality: create direct message conversation and measure performance", async () => {
    const client = workers.get("henry")!.client;
    const dm = await client.conversations.newDm(
      workers.get("ivy")!.client.inboxId,
    );
    expect(dm.id).toBeDefined();
  });

  it("functionality: validate messaging capability using both static and instance canMessage methods", async () => {
    const randomAddress = workers.get("karen")!.address;
    const identifier: Identifier = {
      identifier: randomAddress,
      identifierKind: IdentifierKind.Ethereum,
    };
    const staticCanMessage = await Client.canMessage(
      [identifier],
      workers.get("henry")!.env,
    );
    // Create a client to test the canMessage method
    const henryClient = workers.get("henry")!.client;
    const canMessage = await henryClient.canMessage([identifier]);

    expect(staticCanMessage.get(randomAddress.toLowerCase())).toBe(true);
    expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
  });

  it("functionality: retrieve inbox state with installation validation and key package status", async () => {
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

  it("functionality: query inbox state from external inbox IDs for cross-user information", async () => {
    const bobInboxId = workers.get("bob")!.client.inboxId;
    const inboxState = await workers
      .get("henry")!
      .client.preferences.inboxStateFromInboxIds([bobInboxId], true);
    console.log(inboxState[0].inboxId);
    expect(inboxState[0].inboxId).toBe(bobInboxId);
  });

  it(`downgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getInboxIds(1)[0];

    for (const version of versions) {
      const versionWorkers = await getWorkers(
        ["bob-" + "a" + "-" + version.nodeVersion],
        {
          useVersions: false,
        },
      );

      const bob = versionWorkers.get("bob");
      console.log("Downgraded to ", "sdk:" + String(bob?.sdk));
      let convo = await bob?.client.conversations.newDm(receiverInboxId);

      expect(convo?.id).toBeDefined();
    }
  });

  it(`upgrade last versions`, async () => {
    const versions = getVersions().slice(0, 3);
    const receiverInboxId = getInboxIds(1)[0];

    for (const version of versions.reverse()) {
      const versionWorkers = await getWorkers(
        ["alice-" + "a" + "-" + version.nodeVersion],
        {
          useVersions: false,
        },
      );

      const alice = versionWorkers.get("alice");
      console.log("Upgraded to ", "sdk:" + String(alice?.sdk));
      let convo = await alice?.client.conversations.newDm(receiverInboxId);
      expect(convo?.id).toBeDefined();
    }
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
