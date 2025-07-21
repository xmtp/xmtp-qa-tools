import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "recovery";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(3);
  let group: Group;

  it("recovery: recover conversations after client restart", async () => {
    // Create group and send messages
    group = await workers.createGroupBetweenAll();
    await group.send("Test message before restart");
    await group.send("Another test message");

    const groupId = group.id;
    const creator = workers.getCreator();

    // Simulate client restart by creating new client with same keys
    const restartedClient = await getWorkers([creator.name], {
      useVersions: false,
    });
    const restartedWorker = restartedClient.get(creator.name);
    expect(restartedWorker).toBeDefined();

    // Sync conversations to recover state
    await restartedWorker!.client.conversations.sync();

    // Verify group is recovered
    const recoveredGroup =
      await restartedWorker!.client.conversations.getConversationById(groupId);
    expect(recoveredGroup).toBeDefined();
    expect(recoveredGroup!.id).toBe(groupId);

    // Verify messages are recovered
    const messages = await recoveredGroup!.messages();
    expect(messages.length).toBeGreaterThan(0);

    // Verify can send new messages
    await recoveredGroup!.send("Message after recovery");
  });

  it("recovery: recover DM conversations after restart", async () => {
    const sender = workers.getCreator();
    const receiver = workers.getReceiver();

    // Create DM and send message
    const dm = await sender.client.conversations.newDm(receiver.client.inboxId);
    await dm.send("DM test message");

    const dmId = dm.id;

    // Simulate sender restart
    const restartedSender = await getWorkers([sender.name], {
      useVersions: false,
    });
    const restartedWorker = restartedSender.get(sender.name);
    expect(restartedWorker).toBeDefined();

    // Sync to recover
    await restartedWorker!.client.conversations.sync();

    // Verify DM is recovered
    const recoveredDm =
      await restartedWorker!.client.conversations.getConversationById(dmId);
    expect(recoveredDm).toBeDefined();
    expect(recoveredDm!.id).toBe(dmId);

    // Verify can continue conversation
    await recoveredDm!.send("DM message after recovery");
  });

  it("recovery: health check conversation state consistency", async () => {
    // Create group with multiple members
    group = await workers.createGroupBetweenAll();
    await group.send("Health check message");

    // Verify all members can see the same conversation state
    for (const worker of workers.getAll()) {
      await worker.client.conversations.sync();
      const memberGroup = await worker.client.conversations.getConversationById(
        group.id,
      );

      expect(memberGroup).toBeDefined();
      expect(memberGroup!.id).toBe(group.id);

      const messages = await memberGroup!.messages();
      expect(messages.length).toBeGreaterThan(0);
    }
  });

  it("recovery: handle missing conversations gracefully", async () => {
    const worker = workers.getCreator();

    // Try to get non-existent conversation
    const fakeGroupId = "fake-group-id-12345";
    const nonExistentGroup =
      await worker.client.conversations.getConversationById(fakeGroupId);

    expect(nonExistentGroup).toBeUndefined();
  });

  it("recovery: verify conversation persistence across syncs", async () => {
    group = await workers.createGroupBetweenAll();
    const originalName = group.name;
    const originalDescription = group.description;

    // Update group metadata
    await group.updateName("Updated Name");
    await group.updateDescription("Updated Description");

    // Sync and verify persistence
    await group.sync();
    expect(group.name).toBe("Updated Name");
    expect(group.description).toBe("Updated Description");

    // Verify other members see updates after sync
    const otherMember = workers.getReceiver();
    await otherMember.client.conversations.sync();
    const otherMemberGroup =
      await otherMember.client.conversations.getConversationById(group.id);

    expect(otherMemberGroup.name).toBe("Updated Name");
    expect(otherMemberGroup.description).toBe("Updated Description");
  });
});
