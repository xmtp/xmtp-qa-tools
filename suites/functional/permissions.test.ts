import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "permissions";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(5);
  let group: Group;

  it("permissions: add and remove admin permissions", async () => {
    group = await workers.createGroupBetweenAll();
    const member = workers.getReceiver();

    // Initially should not be admin
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

    // Add as admin
    await group.addAdmin(member.client.inboxId);

    expect(group.isAdmin(member.client.inboxId)).toBe(true);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

    // Remove admin
    await group.removeAdmin(member.client.inboxId);
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
  });

  it("permissions: add and remove super admin permissions", async () => {
    const member = workers.getReceiver();

    // Add as super admin
    await group.addSuperAdmin(member.client.inboxId);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(true);
    expect(group.isAdmin(member.client.inboxId)).toBe(false);

    // Remove super admin
    await group.removeSuperAdmin(member.client.inboxId);
    expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);
    expect(group.isAdmin(member.client.inboxId)).toBe(false);
  });

  it("permissions: verify admin list management", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const member1 = workers.getReceiver();
    const member2 = workers.getCreator();

    // Add multiple admins
    await newGroup.addAdmin(member1.client.inboxId);
    await newGroup.addSuperAdmin(member2.client.inboxId);

    const admins = newGroup.admins;
    const superAdmins = newGroup.superAdmins;

    expect(admins).toContain(member1.client.inboxId);
    expect(superAdmins).not.toContain(member1.client.inboxId);
  });

  it("permissions: admin can remove other members", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const targetMember = workers.getReceiver();

    // Make admin
    await newGroup.addAdmin(targetMember.client.inboxId);
    // Admin should be able to remove member
    const initialMembers = await newGroup.members();
    await newGroup.removeMembers([targetMember.client.inboxId]);
    const finalMembers = await newGroup.members();

    expect(finalMembers.length).toBe(initialMembers.length - 1);
  });

  it("permissions: super admin can manage other admins", async () => {
    const superAdmin = workers.getReceiver();
    const regularAdmin = workers.getAll()[3];

    // Make super admin
    await group.addSuperAdmin(superAdmin.client.inboxId);

    // Add regular admin
    await group.addAdmin(regularAdmin.client.inboxId);
    expect(group.isAdmin(regularAdmin.client.inboxId)).toBe(true);

    // Super admin should be able to remove regular admin
    await group.removeAdmin(regularAdmin.client.inboxId);
    expect(group.isAdmin(regularAdmin.client.inboxId)).toBe(false);
  });
});
