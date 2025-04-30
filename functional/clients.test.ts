import { closeEnv, loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { Client, IdentifierKind, type Identifier } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  beforeAll(async () => {
    workers = await getWorkers(
      [
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
      ],
      testName,
    );
  });
  afterAll(async () => {
    try {
      await closeEnv(testName, workers);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });

  it("clientCreate: should measure creating a client", async () => {
    try {
      const client = await getWorkers(["randomclient"], testName, "message");
      expect(client).toBeDefined();
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
  it("getInboxIdByAddress: should measure getInboxIdByAddress", async () => {
    try {
      const client = workers.get("henry")!.client;
      const randomAddress = workers.get("ivy")!.address;
      const inboxId = await client.getInboxIdByIdentifier({
        identifier: randomAddress,
        identifierKind: IdentifierKind.Ethereum,
      });
      console.log("installationId", client.installationId);
      expect(client.installationId).toBeDefined();
      expect(inboxId).toBeDefined();
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });

  it("createDm: should measure createDm", async () => {
    try {
      const client = workers.get("henry")!.client;
      const dm = await client.conversations.newDm(
        workers.get("ivy")!.client.inboxId,
      );
      expect(dm.id).toBeDefined();
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });

  it("canMessage: should measure static canMessage", async () => {
    try {
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

      console.log("staticCanMessage", Object.fromEntries(staticCanMessage));
      console.log("canMessage", Object.fromEntries(canMessage));
      expect(staticCanMessage.get(randomAddress.toLowerCase())).toBe(true);
      expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
  it("inboxState: should measure inboxState of henry", async () => {
    try {
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
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
  it("inboxStateFromInboxIds: should measure inboxState of henry", async () => {
    try {
      const bobInboxId = workers.get("bob")!.client.inboxId;
      const inboxState = await workers
        .get("henry")!
        .client.preferences.inboxStateFromInboxIds([bobInboxId], true);
      console.log(inboxState[0].inboxId);
      expect(inboxState[0].inboxId).toBe(bobInboxId);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
});
