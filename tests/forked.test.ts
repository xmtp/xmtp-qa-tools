import { closeEnv, loadEnv } from "@helpers/client";
import {
  type Conversation,
  type Group,
  type WorkerManager,
} from "@helpers/types";
import { verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "forked";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let group: Conversation;

  beforeAll(async () => {
    workers = await getWorkers(
      ["bella", "dave", "elon", "diana", "alice", "bob", "random"],
      testName,
    );
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create a group and establish baseline communication", async () => {
    group = await workers
      .get("bella")!
      .client.conversations.newGroup([
        workers.get("dave")!.client.inboxId,
        workers.get("elon")!.client.inboxId,
      ]);

    await group.send("Initial message in epoch 0");
    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should force an epoch transition by adding members", async () => {
    await (group as Group).addMembers([
      workers.get("diana")!.client.inboxId,
      workers.get("random")!.client.inboxId,
    ]);

    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle the 'echo chamber' scenario with rapid message exchanges", async () => {
    // Get group references for different members
    const bellaGroup = group;
    const daveGroup = await workers
      .get("dave")
      ?.client?.conversations.getConversationById(group.id);
    const dianaGroup = await workers
      .get("diana")
      ?.client?.conversations.getConversationById(group.id);
    const elonGroup = await workers
      .get("elon")
      ?.client?.conversations.getConversationById(group.id);

    // Send messages in rapid succession from different members
    const messagePromises = [];
    messagePromises.push(bellaGroup.send("Bella's echo message 1"));
    messagePromises.push(daveGroup?.send("Dave's echo message 1"));
    messagePromises.push(dianaGroup?.send("Diana's echo message 1"));
    messagePromises.push(elonGroup?.send("Elon's echo message 1"));

    // Wait for all messages to be sent
    await Promise.all(messagePromises);

    // Send a second round of messages
    const secondRoundPromises = [];
    secondRoundPromises.push(bellaGroup.send("Bella's echo message 2"));
    secondRoundPromises.push(daveGroup?.send("Dave's echo message 2"));
    secondRoundPromises.push(dianaGroup?.send("Diana's echo message 2"));
    secondRoundPromises.push(elonGroup?.send("Elon's echo message 2"));

    // Wait for all messages to be sent
    await Promise.all(secondRoundPromises);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify everyone can still communicate
    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should remove a member and re-add them from a different device without forking", async () => {
    await (group as Group).removeMembers([
      workers.get("diana")!.client.inboxId,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const secondaryWorkers = await getWorkers(["diana-b"], testName);
    const dianaNewDevice = secondaryWorkers.get("diana", "b")!;

    await (group as Group).addMembers([dianaNewDevice.client?.inboxId ?? ""]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const dianaNewGroup =
      await dianaNewDevice.client?.conversations.getConversationById(group.id);
    await dianaNewGroup?.send("Message from Diana's new device");

    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle the 'musical chairs' scenario with rapid member cycling", async () => {
    // Rapidly remove and add different members in sequence
    // Remove Alice (if present)
    try {
      await (group as Group).removeMembers([
        workers.get("alice")!.client.inboxId ?? "",
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (e) {
      // Alice might not be in the group yet
    }

    // Add Alice
    await (group as Group).addMembers([
      workers.get("alice")!.client.inboxId ?? "",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Remove Elon
    await (group as Group).removeMembers([
      workers.get("elon")!.client.inboxId ?? "",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Add Bob
    await (group as Group).addMembers([
      workers.get("bob")!.client.inboxId ?? "",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Remove Random
    await (group as Group).removeMembers([
      workers.get("random")!.client.inboxId ?? "",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Add Random back
    await (group as Group).addMembers([
      workers.get("random")!.client.inboxId ?? "",
    ]);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify everyone can communicate
    await group.send("Message after musical chairs");
    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle extreme concurrent operations from multiple clients without forking", async () => {
    const operations = [];

    operations.push((group as Group).updateName("Extreme concurrent test"));

    const daveGroup = await workers
      .get("dave")
      ?.client?.conversations.getConversationById(group.id);
    operations.push(daveGroup?.send("Dave's concurrent message"));

    const aliceGroup = await workers
      .get("alice")
      ?.client?.conversations.getConversationById(group.id);
    operations.push(aliceGroup?.send("Alice's concurrent message"));

    await Promise.all(operations);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle the 'chaos monkey' scenario with random operations", async () => {
    // Create an array of possible operations
    const chaosOperations = [];

    // 1. Update group name
    chaosOperations.push(
      (group as Group).updateName(
        "Chaos Test " + Math.random().toString(36).substring(7),
      ),
    );

    // 2. Send messages from different members
    const randomGroup = await workers
      .get("random")
      ?.client?.conversations.getConversationById(group.id);
    chaosOperations.push(randomGroup?.send("Random chaos message"));

    const bobGroup = await workers
      .get("bob")
      ?.client?.conversations.getConversationById(group.id);
    chaosOperations.push(bobGroup?.send("Bob chaos message"));

    // 3. Add a member that was previously removed
    try {
      chaosOperations.push(
        (group as Group).addMembers([
          workers.get("elon")!.client.inboxId ?? "",
        ]),
      );
    } catch (e) {
      // Elon might already be in the group
    }

    // Execute operations in random order
    await Promise.allSettled(chaosOperations);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify group consistency
    const result = await verifyStreamAll(group, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle race conditions with simultaneous group operations", async () => {
    const raceGroup = await workers
      .get("bella")!
      .client.conversations.newGroup([
        workers.get("dave")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
        workers.get("bob")!.client.inboxId,
      ]);

    await raceGroup.send("Initial message in race test group");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const bellaRaceGroup = raceGroup;
    const daveRaceGroup = await workers
      .get("dave")
      ?.client?.conversations.getConversationById(raceGroup.id);
    const aliceRaceGroup = await workers
      .get("alice")
      ?.client?.conversations.getConversationById(raceGroup.id);
    const bobRaceGroup = await workers
      .get("bob")
      ?.client?.conversations.getConversationById(raceGroup.id);

    await bellaRaceGroup.addMembers([workers.get("random")!.client.inboxId]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const operations = [];
    operations.push(
      (daveRaceGroup as Group).removeMembers([
        workers.get("bob")!.client.inboxId,
      ]),
    );
    operations.push(
      (aliceRaceGroup as Group).updateName("Race condition test"),
    );
    operations.push(
      bobRaceGroup
        ?.send("Message from Bob during race condition")
        .catch(() => null),
    );
    operations.push(
      bellaRaceGroup.send("Message from Bella during race condition"),
    );

    await Promise.allSettled(operations);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const randomRefreshed = await workers
      .get("random")
      ?.client?.conversations.getConversationById(raceGroup.id);
    await randomRefreshed?.send("Message from Random after race conditions");

    const result = await verifyStreamAll(raceGroup, workers);
    expect(result.allReceived).toBe(true);
  });

  it("should handle the 'phoenix' scenario where a group is rebuilt from ashes", async () => {
    // Create a new group for this test
    const phoenixGroup = await workers
      .get("bella")!
      .client.conversations.newGroup([
        workers.get("dave")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
      ]);

    await phoenixGroup.send("Initial phoenix group message");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Remove all members except the creator
    await phoenixGroup.removeMembers([
      workers.get("dave")!.client.inboxId,
      workers.get("alice")!.client.inboxId,
    ]);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Add all members back plus some new ones
    await phoenixGroup.addMembers([
      workers.get("dave")!.client.inboxId,
      workers.get("alice")!.client.inboxId,
      workers.get("bob")!.client.inboxId,
      workers.get("random")!.client.inboxId,
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify the reborn group works
    await phoenixGroup.send("Phoenix group reborn message");

    // Get references for all members
    const davePhoenix = await workers
      .get("dave")
      ?.client?.conversations.getConversationById(phoenixGroup.id);
    const alicePhoenix = await workers
      .get("alice")
      ?.client?.conversations.getConversationById(phoenixGroup.id);
    const bobPhoenix = await workers
      .get("bob")
      ?.client?.conversations.getConversationById(phoenixGroup.id);
    const randomPhoenix = await workers
      .get("random")
      ?.client?.conversations.getConversationById(phoenixGroup.id);

    // Have each member send a message
    await davePhoenix?.send("Dave's phoenix message");
    await alicePhoenix?.send("Alice's phoenix message");
    await bobPhoenix?.send("Bob's phoenix message");
    await randomPhoenix?.send("Random's phoenix message");

    // Verify everyone can communicate
    const result = await verifyStreamAll(phoenixGroup, workers);
    expect(result.allReceived).toBe(true);
  });
});
