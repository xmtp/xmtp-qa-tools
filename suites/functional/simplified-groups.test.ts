import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "simplified-groups";

describe(testName, async () => {
  setupTestLifecycle({ testName });

  // Simplified worker setup - just get what we need
  const workers = await getWorkers(["alice", "bob", "charlie", "dave", "eve"]);

  let testGroup: Group;

  it("should create and configure a group with simplified setup", async () => {
    // Create group in one step
    testGroup = (await workers
      .getCreator()
      .client.conversations.newGroup([
        workers.get("bob")!.client.inboxId,
        workers.get("charlie")!.client.inboxId,
        workers.get("dave")!.client.inboxId,
      ])) as Group;

    // Basic validation
    expect(testGroup).toBeDefined();
    expect(testGroup.id).toBeDefined();

    // Set group name in one operation
    await testGroup.updateName("Test Group");

    // Sync and verify member count
    await testGroup.sync();
    const members = await testGroup.members();
    expect(members.length).toBe(4); // creator + 3 members
    expect(testGroup.name).toBe("Test Group");
  });

  it("should handle messaging with simplified stream verification", async () => {
    // Start streams for all participants at once
    workers.getAllButCreator().forEach((worker) => {
      worker.worker.startStream(typeofStream.Message);
    });

    // Send message and verify delivery
    const message = "Hello simplified group!";
    await testGroup.send(message);

    const verifyResult = await verifyMessageStream(
      testGroup,
      workers.getAllButCreator(),
      1,
      message,
    );

    expect(verifyResult.allReceived).toBe(true);
  });

  it("should manage group membership efficiently", async () => {
    // Add new member
    await testGroup.addMembers([workers.get("eve")!.client.inboxId]);

    // Verify member addition
    await testGroup.sync();
    let members = await testGroup.members();
    expect(members.length).toBe(5);

    // Remove member
    await testGroup.removeMembers([workers.get("eve")!.client.inboxId]);

    // Verify member removal
    await testGroup.sync();
    members = await testGroup.members();
    expect(members.length).toBe(4);
  });

  it("should perform group operations without complex loops", async () => {
    // Single comprehensive test instead of multiple similar tests
    const operations = [
      () => testGroup.updateName("Updated Group"),
      () => testGroup.updateDescription("A test group for simplified testing"),
      () => testGroup.send("Test message 1"),
      () => testGroup.send("Test message 2"),
    ];

    // Execute all operations
    for (const operation of operations) {
      await operation();
    }

    // Single sync and verification
    await testGroup.sync();
    expect(testGroup.name).toBe("Updated Group");
    expect(testGroup.description).toBe("A test group for simplified testing");
  });
});
