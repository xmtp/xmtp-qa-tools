import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "installations";

describe(testName, () => {
  setupTestLifecycle({ testName });

  it("shared identity and separate storage", async () => {
    const names = ["alice", "bob", "charlie"];

    // Create primary installations
    const primary = await getWorkers([names[0], names[1]]);
    primary.startStream(typeofStream.Message);

    // Create secondary installations with different folders
    const secondary = await getWorkers([
      names[0] + "-desktop",
      names[1] + "-mobile",
    ]);
    secondary.startStream(typeofStream.Message);

    // Verify shared identity but separate storage
    expect(primary.get(names[0])?.client.inboxId).toBe(
      secondary.get(names[0], "desktop")?.client.inboxId,
    );
    expect(primary.get(names[1])?.client.inboxId).toBe(
      secondary.get(names[1], "mobile")?.client.inboxId,
    );
    expect(primary.get(names[0])?.dbPath).not.toBe(
      secondary.get(names[0], "desktop")?.dbPath,
    );
  });

  it("cross-installation messaging", async () => {
    const names = ["alice", "bob"];

    // Create installations
    const alice = await getWorkers([names[0], names[0] + "-desktop"]);
    const bob = await getWorkers([names[1]]);

    alice.startStream(typeofStream.Message);
    bob.startStream(typeofStream.Message);

    // Send message from desktop to bob
    const conversation = await alice
      .get(names[0], "desktop")
      ?.client.conversations.newDm(bob.get(names[1])?.client.inboxId ?? "");
    await conversation?.send("Hello from desktop");

    // Verify bob receives message
    await bob.get(names[1])?.client.conversations.sync();
    const conversations = await bob.get(names[1])?.client.conversations.list();
    expect(conversations?.length).toBeGreaterThan(0);
  });

  it("installation revocation", async () => {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = "david";

    // Create multiple installations
    const workers = await getWorkers([name, name + "-" + randomSuffix]);

    // Verify initial installation count
    const initialState = await workers
      .get(name)
      ?.client.preferences.inboxState(true);
    expect(initialState?.installations.length).toBe(2);

    // Revoke other installations
    await workers.get(name)?.client.revokeAllOtherInstallations();
    await workers.get(name + "-" + randomSuffix)?.worker.clearDB();

    // Verify final installation count
    const finalState = await workers
      .get(name)
      ?.client.preferences.inboxState(true);
    expect(finalState?.installations.length).toBe(1);
  });
});
