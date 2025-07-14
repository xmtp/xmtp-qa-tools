import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
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

  it("should measure XMTP client creation performance and initialization", async () => {
    const client = await getWorkers(["randomclient"]);
    expect(client).toBeDefined();
  });

  it("should resolve inbox ID from Ethereum address using getInboxIdByAddress", async () => {
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

  it("should create direct message conversation and measure performance", async () => {
    const client = workers.get("henry")!.client;
    const dm = await client.conversations.newDm(
      workers.get("ivy")!.client.inboxId,
    );
    expect(dm.id).toBeDefined();
  });

  it("should validate messaging capability using both static and instance canMessage methods", async () => {
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

  it("should retrieve inbox state with installation validation and key package status", async () => {
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

  it("should query inbox state from external inbox IDs for cross-user information", async () => {
    const bobInboxId = workers.get("bob")!.client.inboxId;
    const inboxState = await workers
      .get("henry")!
      .client.preferences.inboxStateFromInboxIds([bobInboxId], true);
    console.log(inboxState[0].inboxId);
    expect(inboxState[0].inboxId).toBe(bobInboxId);
  });
});
