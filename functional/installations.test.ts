import { closeEnv, loadEnv } from "@helpers/client";
import type { WorkerManager } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "installations";
loadEnv(testName);

describe(testName, () => {
  // Create a container to hold all workers for cleanup
  let initialWorkers: WorkerManager;

  beforeAll(async () => {
    initialWorkers = await getWorkers(["alice", "bob"], testName);
  });
  afterAll(async () => {
    await closeEnv(testName, initialWorkers);
  });

  it("should create and use workers on demand", async () => {
    expect(initialWorkers.get("alice")?.folder).toBe("a");
    expect(initialWorkers.get("bob")?.folder).toBe("a");

    // Create a different installation of alice
    const secondaryWorkers = await getWorkers(
      ["alice-desktop", "bob-b"],
      testName,
    );
    // Merge the new workers with the existing ones
    expect(secondaryWorkers.get("alice", "desktop")?.folder).toBe("desktop");
    expect(secondaryWorkers.get("bob", "b")?.folder).toBe("b");

    // Verify installations of the same person share identity
    expect(initialWorkers.get("bob")?.client.inboxId).toBe(
      secondaryWorkers.get("bob", "b")?.client.inboxId,
    );
    expect(initialWorkers.get("alice")?.client.inboxId).toBe(
      secondaryWorkers.get("alice", "desktop")?.client.inboxId,
    );
    expect(initialWorkers.get("bob")?.dbPath).not.toBe(
      secondaryWorkers.get("bob", "b")?.dbPath,
    );

    // But have different database paths
    expect(secondaryWorkers.get("alice", "desktop")?.dbPath).not.toBe(
      secondaryWorkers.get("bob", "b")?.dbPath,
    );
    // Create charlie only when we need him
    const terciaryWorkers = await getWorkers(["charlie"], testName);

    // Send a message from alice's desktop to charlie
    const aliceDesktop = secondaryWorkers.get("alice", "desktop");
    const conversation = await aliceDesktop?.client.conversations.newDm(
      terciaryWorkers.get("charlie")?.client.inboxId ?? "",
    );
    await conversation?.send("Hello Charlie from Alice's desktop");

    // Charlie can see the message
    await terciaryWorkers.get("charlie")?.client.conversations.syncAll();
    const charlieConvs = await terciaryWorkers
      .get("charlie")
      ?.client.conversations.list();
    expect(charlieConvs?.length).toBeGreaterThan(0);

    // Create a backup installation for charlie
    const fourthWorkers = await getWorkers(["charlie-c"], testName);
    // Backup installation should also be able to access the conversation after syncing
    await fourthWorkers.get("charlie")?.client.conversations.syncAll();
    const backupConvs = await fourthWorkers
      .get("charlie", "c")
      ?.client.conversations.list();
    expect(backupConvs?.length).toBeGreaterThan(0);
  });
});
