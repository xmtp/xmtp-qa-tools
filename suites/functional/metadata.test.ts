import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "metadata";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(3);
  let group: Group;

  it("update group name and persistence", async () => {
    group = await workers.createGroupBetweenAll();
    const originalName = group.name;

    // Update name
    const newName =
      "Updated Group Name " + Math.random().toString(36).substring(2, 15);
    await group.updateName(newName);

    // immediate update
    expect(group.name).toBe(newName);

    // Sync and persistence
    await group.sync();
    expect(group.name).toBe(newName);
    expect(group.name).not.toBe(originalName);
  });

  it("update group description and persistence", async () => {
    const newDescription =
      "Updated group description " +
      Math.random().toString(36).substring(2, 15);
    await group.updateDescription(newDescription);

    // immediate update
    expect(group.description).toBe(newDescription);

    // Sync and persistence
    await group.sync();
    expect(group.description).toBe(newDescription);
  });

  it("update group image URL", async () => {
    const imageUrl = "https://example.com/group-image.jpg";
    await group.updateImageUrl(imageUrl);

    // immediate update
    expect(group.imageUrl).toBe(imageUrl);

    // Sync and persistence
    await group.sync();
    expect(group.imageUrl).toBe(imageUrl);
  });

  it("metadata propagation to other members", async () => {
    const testName =
      "Propagated Name " + Math.random().toString(36).substring(2, 15);
    const testDescription =
      "Propagated description " + Math.random().toString(36).substring(2, 15);

    // Update all metadata
    await group.updateName(testName);
    await group.updateDescription(testDescription);
    await group.sync();

    // other members see updates after sync
    const otherMember = workers.getReceiver();
    await otherMember.client.conversations.sync();
    const otherMemberGroup =
      await otherMember.client.conversations.getConversationById(group.id);
    expect(otherMemberGroup).toBeDefined();

    // Cast to Group to access metadata properties
    const otherGroup = otherMemberGroup as Group;
    await otherGroup.sync();
    expect(otherGroup.name).toBe(testName);
    expect(otherGroup.description).toBe(testDescription);
  });

  it("handle empty and special characters in metadata", async () => {
    // Test empty name
    await group.updateName("");
    expect(group.name).toBe("");

    // Test special characters
    const specialName = "Group with 🚀 emoji & symbols!";
    await group.updateName(specialName);
    expect(group.name).toBe(specialName);

    // Test long description
    const longDescription = "A".repeat(1000);
    await group.updateDescription(longDescription);
    expect(group.description).toBe(longDescription);
  });

  it("metadata state after group operations", async () => {
    const finalName = "Final Test Name";
    const finalDescription = "Final test description";

    // Update metadata
    await group.updateName(finalName);
    await group.updateDescription(finalDescription);

    // Perform group operations
    const newMember = workers.getAll()[2];
    await group.addMembers([newMember.client.inboxId]);

    // metadata persists after operations
    expect(group.name).toBe(finalName);
    expect(group.description).toBe(finalDescription);

    // Sync and verify
    await group.sync();
    expect(group.name).toBe(finalName);
    expect(group.description).toBe(finalDescription);
  });
});
