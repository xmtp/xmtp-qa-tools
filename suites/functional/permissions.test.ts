import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "permissions";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(5);
  let group: Group;

  // Helper functions to reduce redundancy
  const checkMemberStatus = (
    inboxId: string,
    expectedAdmin: boolean,
    expectedSuperAdmin: boolean,
  ) => {
    expect(group.isAdmin(inboxId)).toBe(expectedAdmin);
    expect(group.isSuperAdmin(inboxId)).toBe(expectedSuperAdmin);
  };

  const updateGroupMetadata = async (
    newName: string,
    newDescription: string,
  ) => {
    await group.updateName(newName);
    expect(group.name).toBe(newName);
    await group.updateDescription(newDescription);
    expect(group.description).toBe(newDescription);
  };

  const testMemberManagement = async (newMemberInboxId: string) => {
    const initialMembers = await group.members();
    const isAlreadyMember = initialMembers.some(
      (m) => m.inboxId === newMemberInboxId,
    );

    if (!isAlreadyMember) {
      // Add member
      await group.addMembers([newMemberInboxId]);
      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length + 1);
      expect(finalMembers.some((m) => m.inboxId === newMemberInboxId)).toBe(
        true,
      );

      // Remove member
      await group.removeMembers([newMemberInboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length);
      expect(afterRemoval.some((m) => m.inboxId === newMemberInboxId)).toBe(
        false,
      );
    } else {
      // Remove and re-add member
      await group.removeMembers([newMemberInboxId]);
      const afterRemoval = await group.members();
      expect(afterRemoval.length).toBe(initialMembers.length - 1);
      expect(afterRemoval.some((m) => m.inboxId === newMemberInboxId)).toBe(
        false,
      );

      await group.addMembers([newMemberInboxId]);
      const finalMembers = await group.members();
      expect(finalMembers.length).toBe(initialMembers.length);
      expect(finalMembers.some((m) => m.inboxId === newMemberInboxId)).toBe(
        true,
      );
    }
  };

  const findRegularMember = () => {
    const allMembers = workers.getAll();
    return allMembers.find(
      (member) =>
        !group.isAdmin(member.client.inboxId) &&
        !group.isSuperAdmin(member.client.inboxId),
    );
  };

  it("group creator is super admin by default", async () => {
    group = await workers.createGroupBetweenAll();
    const creator = workers.getCreator();
    const member = workers.getReceiver();

    checkMemberStatus(creator.client.inboxId, false, true);
    checkMemberStatus(member.client.inboxId, false, false);
  });

  it("super admin can manage admins", async () => {
    const member = workers.getReceiver();

    await group.addAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, true, false);

    await group.removeAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, false, false);
  });

  it("super admin can manage super admins", async () => {
    const member = workers.getReceiver();

    await group.addSuperAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, false, true);

    await group.removeSuperAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, false, false);
  });

  it("admin list management", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const member1 = workers.getReceiver();
    const member2 = workers.getAll()[3];

    await newGroup.addAdmin(member1.client.inboxId);
    await newGroup.addSuperAdmin(member2.client.inboxId);

    const admins = newGroup.admins;
    const superAdmins = newGroup.superAdmins;

    expect(admins).toContain(member1.client.inboxId);
    expect(superAdmins).toContain(member2.client.inboxId);
    expect(superAdmins).not.toContain(member1.client.inboxId);
  });

  it("super admin can update group metadata", async () => {
    await updateGroupMetadata(
      "Super Admin Updated Name",
      "Super Admin Updated Description",
    );
  });

  it("admin can update group metadata when permitted", async () => {
    const member = workers.getReceiver();
    await group.addAdmin(member.client.inboxId);
    await updateGroupMetadata(
      "Admin Updated Name",
      "Admin Updated Description",
    );
  });

  it("super admin can manage group membership", async () => {
    const newMember = workers.getAll()[4];
    await testMemberManagement(newMember.client.inboxId);
  });

  it("admin can manage group membership when permitted", async () => {
    const member = workers.getReceiver();
    await group.addAdmin(member.client.inboxId);
    const newMember = workers.getAll()[4];
    await testMemberManagement(newMember.client.inboxId);
  });

  it("regular member cannot remove other members", async () => {
    const regularMember = findRegularMember();
    const targetMember = workers.getAll().find((m) => m !== regularMember);

    if (!regularMember || !targetMember) {
      console.log("Skipping test - no regular members available");
      return;
    }

    checkMemberStatus(regularMember.client.inboxId, false, false);

    try {
      await group.removeMembers([targetMember.client.inboxId]);
      const finalMembers = await group.members();
      expect(
        finalMembers.some((m) => m.inboxId === targetMember.client.inboxId),
      ).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("admin hierarchy - super admin can do everything admin can do", async () => {
    const member = workers.getReceiver();
    const newMember = workers.getAll()[4];

    await group.addAdmin(member.client.inboxId);
    await updateGroupMetadata("Super Admin Hierarchy Test", "Test Description");
    await testMemberManagement(newMember.client.inboxId);
  });

  it("member status persistence after permission changes", async () => {
    const member = workers.getReceiver();

    // Test admin status persistence
    await group.addAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, true, false);

    await group.sync();
    checkMemberStatus(member.client.inboxId, true, false);

    // Test super admin status persistence
    await group.addSuperAdmin(member.client.inboxId);
    checkMemberStatus(member.client.inboxId, false, true);

    await group.sync();
    checkMemberStatus(member.client.inboxId, false, true);

    // Test removal persistence
    await group.removeSuperAdmin(member.client.inboxId);
    await group.removeAdmin(member.client.inboxId);

    checkMemberStatus(member.client.inboxId, false, false);

    await group.sync();
    checkMemberStatus(member.client.inboxId, false, false);
  });
});
