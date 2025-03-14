import { createAgent } from "@agents/factory";
import type { AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { afterAll, describe, expect, it } from "vitest";

const testName = "installations";
loadEnv(testName);

describe(testName, () => {
  // Create a container to hold all personas for cleanup
  let agents: AgentManager;

  afterAll(async () => {
    await closeEnv(testName, agents);
  });

  it("should create and use personas on demand", async () => {
    // Create alice with default installation "b"
    agents = await createAgent(["alice", "bob"], testName);
    // Merge the new personas with the existing ones
    expect(agents.get("alice")?.folder).toBe("a");
    expect(agents.get("bob")?.folder).toBe("a");

    // Create a different installation of alice
    const secondaryPersonas = await createAgent(
      ["alice-desktop", "bob-b"],
      testName,
    );
    // Merge the new personas with the existing ones
    expect(secondaryPersonas.get("alice", "desktop")?.folder).toBe("desktop");
    expect(secondaryPersonas.get("bob", "b")?.folder).toBe("b");

    // Verify installations of the same person share identity
    expect(agents.get("bob")?.client.inboxId).toBe(
      secondaryPersonas.get("bob", "b")?.client.inboxId,
    );
    expect(agents.get("alice")?.client.inboxId).toBe(
      secondaryPersonas.get("alice", "desktop")?.client.inboxId,
    );
    expect(agents.get("bob")?.dbPath).not.toBe(
      secondaryPersonas.get("bob", "b")?.dbPath,
    );

    // But have different database paths
    expect(secondaryPersonas.get("alice", "desktop")?.dbPath).not.toBe(
      secondaryPersonas.get("bob", "b")?.dbPath,
    );
    // Create charlie only when we need him
    const terciaryPersonas = await createAgent(["charlie"], testName);

    // Send a message from alice's desktop to charlie
    const aliceDesktop = secondaryPersonas.get("alice", "desktop");
    const conversation = await aliceDesktop?.client.conversations.newDm(
      terciaryPersonas.get("charlie")?.client.inboxId ?? "",
    );
    await conversation?.send("Hello Charlie from Alice's desktop");

    // Charlie can see the message
    await terciaryPersonas.get("charlie")?.client.conversations.syncAll();
    const charlieConvs = await terciaryPersonas
      .get("charlie")
      ?.client.conversations.list();
    expect(charlieConvs?.length).toBeGreaterThan(0);

    // Create a backup installation for charlie
    const fourthPersonas = await createAgent(["charlie-c"], testName);
    // Backup installation should also be able to access the conversation after syncing
    await fourthPersonas.get("charlie")?.client.conversations.syncAll();
    const backupConvs = await fourthPersonas
      .get("charlie", "c")
      ?.client.conversations.list();
    expect(backupConvs?.length).toBeGreaterThan(0);
  });
});
