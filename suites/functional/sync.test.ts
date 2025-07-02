import { sleep } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("sync", async () => {
  const workers = await getWorkers(["alice", "bob", "charlie"]);
  setupTestLifecycle({});

  it("should sync conversations after creation", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    // Sync conversations on both clients
    await alice.client.conversations.sync();
    await bob.client.conversations.sync();

    const aliceConversations = await alice.client.conversations.list();
    const bobConversations = await bob.client.conversations.list();

    expect(aliceConversations.length).toBeGreaterThan(0);
    expect(bobConversations.length).toBeGreaterThan(0);

    // Both should have the same conversation
    const aliceConvo = aliceConversations.find((c) => c.id === dm.id);
    const bobConvo = bobConversations.find((c) => c.id === dm.id);

    expect(aliceConvo).toBeDefined();
    expect(bobConvo).toBeDefined();
  });

  it("should sync messages after sending", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    // Send message from alice
    await dm.send("Hello Bob!");

    // Bob needs to sync to see the message
    await bob.client.conversations.sync();
    const bobDm = await bob.client.conversations.getConversationById(dm.id);
    await bobDm?.sync();

    const messages = await bobDm?.messages();
    expect(messages?.length).toBeGreaterThan(0);

    const lastMessage = messages?.[messages.length - 1];
    expect(lastMessage?.content).toBe("Hello Bob!");
  });

  it("should sync group membership changes", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;
    const charlie = workers.get("charlie")!;

    // Alice creates group with Bob
    const group = await alice.client.conversations.newGroup([
      bob.client.inboxId,
    ]);

    // Add Charlie to the group
    await group.addMembers([charlie.client.inboxId]);

    // Sync all clients
    await alice.client.conversations.sync();
    await bob.client.conversations.sync();
    await charlie.client.conversations.sync();

    await group.sync();

    // Verify all members can see the group
    const aliceGroups = await alice.client.conversations.listGroups();
    const bobGroups = await bob.client.conversations.listGroups();
    const charlieGroups = await charlie.client.conversations.listGroups();

    expect(aliceGroups.some((g) => g.id === group.id)).toBe(true);
    expect(bobGroups.some((g) => g.id === group.id)).toBe(true);
    expect(charlieGroups.some((g) => g.id === group.id)).toBe(true);

    // Verify member count
    const members = await group.members();
    expect(members.length).toBe(3); // Alice, Bob, Charlie
  });

  it("should handle delayed sync gracefully", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    // Send multiple messages quickly
    await dm.send("Message 1");
    await dm.send("Message 2");
    await dm.send("Message 3");

    // Wait a bit before syncing
    await sleep(2000);

    // Now sync and verify all messages are received
    await bob.client.conversations.sync();
    const bobDm = await bob.client.conversations.getConversationById(dm.id);
    await bobDm?.sync();

    const messages = await bobDm?.messages();
    expect(messages?.length).toBeGreaterThanOrEqual(3);

    const messageContents = messages?.map((m) => m.content) || [];
    expect(messageContents).toContain("Message 1");
    expect(messageContents).toContain("Message 2");
    expect(messageContents).toContain("Message 3");
  });

  it("should maintain sync state across client restarts", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    // Create conversation and send message
    const dm = await alice.client.conversations.newDm(bob.client.inboxId);
    await dm.send("Persistent message");

    // Sync bob's client
    await bob.client.conversations.sync();
    const bobDm = await bob.client.conversations.getConversationById(dm.id);
    await bobDm?.sync();

    // Verify message is there
    const messages = await bobDm?.messages();
    expect(messages?.some((m) => m.content === "Persistent message")).toBe(
      true,
    );

    // Simulate restart by creating new conversation reference
    const refreshedDm = await bob.client.conversations.getConversationById(
      dm.id,
    );
    await refreshedDm?.sync();

    const refreshedMessages = await refreshedDm?.messages();
    expect(
      refreshedMessages?.some((m) => m.content === "Persistent message"),
    ).toBe(true);
  });
});
