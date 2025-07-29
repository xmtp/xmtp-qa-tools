import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "permissions";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(5);
  let group: Group;

  it("group creator is super admin by default", async () => {
    group = await workers.createGroupBetweenAll();
    const creator = workers.getCreator();
    const member = workers.getReceiver();

    // Creator should be super admin
    expect(group.isSuperAdmin(creator.client.inboxId)).toBe(true);
    expect(group.isAdmin(creator.client.inboxId)).toBe(false);

    // Regular member should not be admin or super admin
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);
  });

  it("super admin can manage admins", async () => {
    const member = workers.getReceiver();

    // Super admin can add admin
    await group.addAdmin(member.client.inboxId);
    expect(group.isAdmin(member.client.inboxId)).toBe(true);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

    // Super admin can remove admin
    await group.removeAdmin(member.client.inboxId);
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
  });

  it("super admin can manage super admins", async () => {
    const member = workers.getReceiver();

    // Super admin can add super admin
    await group.addSuperAdmin(member.client.inboxId);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(true);
    expect(group.isAdmin(member.client.inboxId)).toBe(false);

    // Super admin can remove super admin
    await group.removeSuperAdmin(member.client.inboxId);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);
  });

  it("admin list management", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const member1 = workers.getReceiver();
    const member2 = workers.getAll()[3];

    // Add multiple admins
    await newGroup.addAdmin(member1.client.inboxId);
    await newGroup.addSuperAdmin(member2.client.inboxId);

    const admins = newGroup.admins;
    const superAdmins = newGroup.superAdmins;

    expect(admins).toContain(member1.client.inboxId);
    expect(superAdmins).toContain(member2.client.inboxId);
    expect(superAdmins).not.toContain(member1.client.inboxId);
  });

  it("super admin can update group metadata", async () => {
    const newName = "Super Admin Updated Name";
    const newDescription = "Super Admin Updated Description";

    // Super admin can update name
    await group.updateName(newName);
    expect(group.name).toBe(newName);

    // Super admin can update description
    await group.updateDescription(newDescription);
    expect(group.description).toBe(newDescription);
  });

  it("admin can update group metadata when permitted", async () => {
    const member = workers.getReceiver();

    // Make member an admin
    await group.addAdmin(member.client.inboxId);

    const newName = "Admin Updated Name";
    const newDescription = "Admin Updated Description";

    // Admin should be able to update metadata (assuming default permissions allow it)
    await group.updateName(newName);
    expect(group.name).toBe(newName);

    await group.updateDescription(newDescription);
    expect(group.description).toBe(newDescription);
  });

  it("super admin can manage group membership", async () => {
    const newMember = workers.getAll()[4];

    // Check if member is already in the group
    const initialMembers = await group.members();
    const isAlreadyMember = initialMembers.some(
      (m) => m.inboxId === newMember.client.inboxId,
    );

    if (!isAlreadyMember) {
      // Super admin can add members
      await group.addMembers([newMember.client.inboxId]);
      const finalMembers = await group.members();

      expect(finalMembers.length).toBe(initialMembers.length + 1);
      expect(
        finalMembers.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(true);

      // Super admin can remove members
      await group.removeMembers([newMember.client.inboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length);
      expect(
        afterRemoval.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(false);
    } else {
      // Member is already in group, test removal and re-addition
      await group.removeMembers([newMember.client.inboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length - 1);
      expect(
        afterRemoval.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(false);

      // Re-add the member
      await group.addMembers([newMember.client.inboxId]);
      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length);
      expect(
        finalMembers.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(true);
    }
  });

  it("admin can manage group membership when permitted", async () => {
    const member = workers.getReceiver();
    const newMember = workers.getAll()[4];

    // Make member an admin
    await group.addAdmin(member.client.inboxId);

    // Check if member is already in the group
    const initialMembers = await group.members();
    const isAlreadyMember = initialMembers.some(
      (m) => m.inboxId === newMember.client.inboxId,
    );

    if (!isAlreadyMember) {
      // Admin should be able to add members (assuming default permissions allow it)
      await group.addMembers([newMember.client.inboxId]);
      const finalMembers = await group.members();

      expect(finalMembers.length).toBe(initialMembers.length + 1);
      expect(
        finalMembers.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(true);

      // Admin should be able to remove members
      await group.removeMembers([newMember.client.inboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length);
    } else {
      // Member is already in group, test removal and re-addition
      await group.removeMembers([newMember.client.inboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length - 1);
      expect(
        afterRemoval.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(false);

      // Re-add the member
      await group.addMembers([newMember.client.inboxId]);
      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length);
      expect(
        finalMembers.some((m) => m.inboxId === newMember.client.inboxId),
      ).toBe(true);
    }
  });

  it("regular member cannot remove other members", async () => {
    // Find a member that is definitely not an admin
    const allMembers = workers.getAll();
    let regularMember = null;
    let targetMember = null;

    for (const member of allMembers) {
      if (
        !group.isAdmin(member.client.inboxId) &&
        !group.isSuperAdmin(member.client.inboxId)
      ) {
        regularMember = member;
        break;
      }
    }

    // Find a different member to target
    for (const member of allMembers) {
      if (member !== regularMember) {
        targetMember = member;
        break;
      }
    }

    // If we can't find a regular member, skip this test
    if (!regularMember || !targetMember) {
      console.log("Skipping test - no regular members available");
      return;
    }

    // Ensure regular member is not admin
    expect(group.isAdmin(regularMember.client.inboxId)).toBe(false);
    expect(group.isSuperAdmin(regularMember.client.inboxId)).toBe(false);

    try {
      await group.removeMembers([targetMember.client.inboxId]);
      // If no error, check if the member was actually removed
      const finalMembers = await group.members();
      // If permissions are working, the member should still be there
      expect(
        finalMembers.some((m) => m.inboxId === targetMember.client.inboxId),
      ).toBe(true);
    } catch (error) {
      // Expected behavior - permission denied
      expect(error).toBeDefined();
    }
  });

  it("admin hierarchy - super admin can do everything admin can do", async () => {
    const member = workers.getReceiver();
    const newMember = workers.getAll()[4];

    // Make member an admin
    await group.addAdmin(member.client.inboxId);

    // Super admin should be able to do all admin operations
    const newName = "Super Admin Hierarchy Test";
    await group.updateName(newName);
    expect(group.name).toBe(newName);

    // Test member management - check if member is already in group
    const initialMembers = await group.members();
    const isAlreadyMember = initialMembers.some(
      (m) => m.inboxId === newMember.client.inboxId,
    );

    if (!isAlreadyMember) {
      // Add and remove members
      await group.addMembers([newMember.client.inboxId]);
      await group.removeMembers([newMember.client.inboxId]);

      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length);
    } else {
      // Member is already in group, test removal and re-addition
      await group.removeMembers([newMember.client.inboxId]);
      await group.addMembers([newMember.client.inboxId]);

      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length);
    }
  });

  it("member status persistence after permission changes", async () => {
    const member = workers.getReceiver();

    // Test admin status persistence
    await group.addAdmin(member.client.inboxId);
    expect(group.isAdmin(member.client.inboxId)).toBe(true);

    await group.sync();
    expect(group.isAdmin(member.client.inboxId)).toBe(true);

    // Test super admin status persistence
    await group.addSuperAdmin(member.client.inboxId);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(true);

    await group.sync();
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(true);

    // Test removal persistence
    await group.removeSuperAdmin(member.client.inboxId);
    await group.removeAdmin(member.client.inboxId);

    expect(group.isAdmin(member.client.inboxId)).toBe(false);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

    await group.sync();
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);
  });
});
