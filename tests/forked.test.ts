import { closeEnv, loadEnv } from "@helpers/client";
import {
  type Conversation,
  type Group,
  type NestedPersonas,
} from "@helpers/types";
import { verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "forked";
loadEnv(testName);

describe(testName, () => {
  let personas: NestedPersonas;
  let group: Conversation;
  let daveGroup: Group;
  let bellaGroup: Group;
  let elonGroup: Group;
  let randomGroup: Group;
  beforeAll(async () => {
    personas = await getWorkers(
      ["bella", "dave", "elon", "diana", "alice", "bob"],
      testName,
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("should create a group and establish baseline communication", async () => {
    // Create initial group with a few members
    group = await personas
      .get("bella")!
      .client!.conversations.newGroup([
        personas.get("dave")!.client!.inboxId,
        personas.get("elon")!.client!.inboxId,
      ]);

    expect(group).toBeDefined();
    expect(group.id).toBeDefined();

    // Send initial messages to establish that communication works
    await group.send("Initial message in epoch 0");

    const result = await verifyStreamAll(group, personas);
    expect(result.allReceived).toBe(true);
  });

  it("should force an epoch transition by adding members", async () => {
    // Adding members should trigger an epoch transition in MLS
    console.log("Adding members to trigger epoch transition");
    await (group as Group).addMembers([
      personas.get("diana")!.client!.inboxId,
      personas.get("random")!.client!.inboxId,
    ]);
    // Verify all members including new ones can receive messages
    const result = await verifyStreamAll(group, personas);
    expect(result.allReceived).toBe(true);
  });

  it("should check that all members have the same group", async () => {
    daveGroup = (await personas
      .get("dave")
      ?.client?.conversations.getConversationById(group.id)) as Group;
    expect(daveGroup.id).toBe(group.id);
    elonGroup = (await personas
      .get("elon")
      ?.client?.conversations.getConversationById(group.id)) as Group;
    expect(elonGroup.id).toBe(group.id);
    bellaGroup = (await personas
      .get("bella")
      ?.client?.conversations.getConversationById(group.id)) as Group;
    expect(bellaGroup.id).toBe(group.id);

    randomGroup = (await personas
      .get("random")
      ?.client?.conversations.getConversationById(group.id)) as Group;
    expect(randomGroup.id).toBe(group.id);
  });
  it("should execute concurrent operations", async () => {
    await bellaGroup.addMembers([personas.get("alice")?.client?.inboxId ?? ""]);

    await bellaGroup.removeMembers([
      personas.get("elon")?.client?.inboxId ?? "",
    ]);

    await bellaGroup.updateName("Updated in potential fork");
  });

  it("should verify group consistency after potential fork", async () => {
    // Allow some time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Sending messages");
    // Send messages from different clients to check if they're still in sync
    await bellaGroup.send("Message from Bella after concurrent operations");
    await daveGroup.send("Message from Dave after concurrent operations");
    await elonGroup.send("Message from Elon after concurrent operations");
    console.log("Messages sent");
    // Verify messages can be received by all remaining members
    const result = await verifyStreamAll(group, personas);

    expect(result.allReceived).toBe(true);
  });

  // it("should verify group consistency after potential fork", async () => {
  //   // Get messages as seen by different members
  //   await group.sync();
  //   const bellaMessages = await group.messages();
  //   const daveGroup = await personas
  //     .get("dave")
  //     ?.client?.conversations.getConversationById(group.id);

  //   await daveGroup?.sync();
  //   const daveMessages = await daveGroup?.messages();

  //   const elonGroup = await personas
  //     .get("elon")
  //     ?.client?.conversations.getConversationById(group.id);
  //   await elonGroup?.sync();
  //   const elonMessages = await elonGroup?.messages();

  //   const dianaGroup = await personas
  //     .get("diana")
  //     ?.client?.conversations.getConversationById(group.id);
  //   await dianaGroup?.sync();
  //   const dianaMessages = await dianaGroup?.messages();

  //   const aliceGroup = await personas
  //     .get("alice")
  //     ?.client?.conversations.getConversationById(group.id);
  //   await aliceGroup?.sync();
  //   const aliceMessages = await aliceGroup?.messages();

  //   // Check that all members see the same messages (no forking/divergence)
  //   expect(bellaMessages.length).toBeGreaterThan(0);
  //   // Users added later start with 0 history, and even the creator's first message is only to itself
  //   expect(daveMessages?.length).toBe(bellaMessages.length - 1);
  //   expect(elonMessages?.length).toBe(bellaMessages.length - 1);
  //   // Diana was added in the second test, so she should have 9 messages (missing the first 4)
  //   expect(dianaMessages?.length).toBe(9);

  //   // Alice was added during the concurrent operations test, so she should have fewer messages
  //   // than Diana and the original members
  //   expect(aliceMessages?.length).toBe(5);
  // });

  // it("should remove a member and re-add them from a different device without forking", async () => {
  //   // First, remove Diana from the group
  //   console.log("Removing Diana from the group");
  //   await (group as Group).removeMembers([
  //     personas.get("diana")?.client?.inboxId,
  //   ]);

  //   // Send a message after removal
  //   await group.send("Message after Diana was removed");

  //   // Allow time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Create a new installation for Diana (simulating a different device)
  //   console.log("Creating a new installation for Diana");

  //   const dianaNewDevice = personas.get("diana", "b")!;
  //   expect(dianaNewDevice).toBeDefined();
  //   expect(dianaNewDevice.client).toBeDefined();
  //   expect(dianaNewDevice.installationId).not.toBe(
  //     personas.get("diana")?.installationId,
  //   );

  //   console.log(
  //     `Diana's original installation ID: ${personas.get("diana")?.installationId}`,
  //   );
  //   console.log(
  //     `Diana's new installation ID: ${dianaNewDevice.installationId}`,
  //   );

  //   // Re-add Diana using her new installation's inbox ID
  //   console.log("Re-adding Diana from her new device");
  //   await (group as Group).addMembersByInboxId([
  //     dianaNewDevice.client?.inboxId ?? "",
  //   ]);

  //   // Send messages from different members
  //   await group.send("Message from Bella after Diana was re-added");

  //   const elonGroup = await personas
  //     .get("elon")
  //     ?.client?.conversations.getConversationById(group.id);
  //   await elonGroup?.send("Message from Elon after Diana was re-added");

  //   // Allow time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Get Diana's group from her new installation
  //   const dianaNewGroup =
  //     await dianaNewDevice.client?.conversations.getConversationById(group.id);

  //   expect(dianaNewGroup).toBeDefined();

  //   // Diana sends a message from her new device
  //   await dianaNewGroup?.send("Message from Diana's new device");

  //   // Allow time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Verify all members can communicate
  //   const result = await verifyStream(group, [
  //     personas.get("bella")!,
  //     dianaNewDevice,
  //   ]);

  //   expect(result.allReceived).toBe(true);

  //   // Verify group consistency across different members
  //   await group.sync();
  //   const bellaMessages = await group.messages();

  //   await elonGroup?.sync();

  //   await dianaNewGroup?.sync();
  //   const dianaNewMessages = await dianaNewGroup?.messages();

  //   // Diana's new device should have fewer messages since she was re-added later
  //   expect(dianaNewMessages?.length).toBeGreaterThan(0);
  //   expect(dianaNewMessages?.length).toBeLessThan(bellaMessages.length);

  //   // Verify the group name is consistent across all members
  //   const bellaGroupName = (group as Group).name;
  //   const elonGroupName = (elonGroup as Group).name;
  //   const dianaNewGroupName = (dianaNewGroup as Group).name;

  //   expect(elonGroupName).toBe(bellaGroupName);
  //   expect(dianaNewGroupName).toBe(bellaGroupName);
  // });

  // it("should simulate a network partition by adding members from different clients", async () => {
  //   // Get references to the group for different members
  //   const bellaGroup = group;
  //   const daveGroup = await personas
  //     .get("dave")
  //     ?.client?.conversations.getConversationById(group.id);

  //   if (!daveGroup) {
  //     throw new Error("Could not get group reference for Dave");
  //   }

  //   // Add a member from Bella's client
  //   await (bellaGroup as Group).addMembers([
  //     personas.get("bob")?.client?.inboxId,
  //   ]);

  //   // Send a message from Bella
  //   await bellaGroup.send("Message from Bella after adding Bob");

  //   // Allow some time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Send a message from Dave
  //   await daveGroup.send("Message from Dave after Bella added Bob");

  //   // Allow some time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Verify all members are in sync and can receive messages
  //   const result = await verifyStream(group, [
  //     personas.get("bella")!,
  //     personas.get("dave")!,
  //     personas.get("elon")!,
  //     personas.get("diana")!,
  //     personas.get("alice")!,
  //     personas.get("bob")!,
  //   ]);

  //   expect(result.allReceived).toBe(true);
  // });
  // it("should handle rapid consecutive member changes without forking", async () => {
  //   // Perform a series of rapid member changes that would likely cause epoch transitions
  //   console.log("Starting rapid consecutive member changes...");

  //   // Add one member
  //   await (group as Group).addMembers([
  //     personas.get("random")?.client?.inboxId,
  //   ]);

  //   // Immediately remove that member
  //   await (group as Group).removeMembers([
  //     personas.get("random")?.client?.inboxId,
  //   ]);

  //   // Add them again
  //   await (group as Group).addMembers([
  //     personas.get("random")?.client?.inboxId,
  //   ]);

  //   // Remove a different member
  //   await (group as Group).removeMembers([
  //     personas.get("bob")?.client?.inboxId,
  //   ]);

  //   // Add the removed member back
  //   await (group as Group).addMembers([
  //     personas.get("bob")?.client?.inboxId,
  //   ]);

  //   // Allow time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Send a message from different members
  //   await group.send("Message from Bella after rapid member changes");
  //   const daveGroup = await personas
  //     .get("dave")
  //     ?.client?.conversations.getConversationById(group.id);

  //   await daveGroup?.send("Message from Dave after rapid member changes");

  //   const randomGroup = await personas
  //     .get("random")
  //     ?.client?.conversations.getConversationById(group.id);

  //   await randomGroup?.send("Message from Random after rapid member changes");

  //   // Verify all members can still communicate
  //   const result = await verifyStreamAll(group, personas);
  //   expect(result.allReceived).toBe(true);
  // });
  // it("should recover from simulated network partition", async () => {
  //   // Simulate network partition by having no communication for a period
  //   console.log("Simulating network partition...");
  //   await new Promise((resolve) => setTimeout(resolve, 2000));

  //   // Get references to the group for different members
  //   const bellaGroup = group;
  //   const bobGroup = await personas
  //     .get("bob")
  //     ?.client?.conversations.getConversationById(group.id);

  //   if (!bobGroup) {
  //     throw new Error("Could not get group reference for Bob");
  //   }

  //   // After "network partition", make changes from both sides
  //   await (bellaGroup as Group).updateName("Bella's post-partition update");
  //   await bobGroup.send("Bob's post-partition message");

  //   // Allow time for synchronization
  //   await new Promise((resolve) => setTimeout(resolve, 1000));

  //   // Check that all members see the same group state
  //   const bellaMetadata = await personas
  //     .get("bella")
  //     ?.client?.conversations.getConversationById(group.id);
  //   const bobMetadata = await personas
  //     .get("bob")
  //     ?.client?.conversations.getConversationById(group.id);
  //   const daveMetadata = await personas
  //     .get("dave")
  //     ?.client?.conversations.getConversationById(group.id);

  //   expect((bobMetadata as Group).name).toBe((bellaMetadata as Group).name);
  //   expect((daveMetadata as Group).name).toBe((bellaMetadata as Group).name);

  //   // Verify messages can be sent and received
  //   const result = await verifyStream(group, [
  //     personas.get("bella")!,
  //     personas.get("dave")!,
  //     personas.get("elon")!,
  //     personas.get("diana")!,
  //     personas.get("alice")!,
  //     personas.get("bob")!,
  //   ]);

  //   expect(result.allReceived).toBe(true);
  // });
});
