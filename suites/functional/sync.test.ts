import { sleep } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers: WorkerManager;
  let testGroup: Group;

  // Define test workers
  const testWorkers = ["henry", "ivy", "jack"];
  workers = await getWorkers(testWorkers);

  it("test syncall - client.conversations.sync()", async () => {
    // Create a group with test workers
    const memberInboxIds = testWorkers
      .filter((name) => name !== "henry") // Exclude creator from the members list
      .map((name) => workers.get(name)!.client.inboxId);

    console.log("Creating test group with", memberInboxIds.length, "members");
    testGroup = (await workers
      .get("henry")!
      .client.conversations.newGroup(memberInboxIds, {
        groupName: "Sync Test Group",
        groupDescription: "Group for testing sync methods",
      })) as Group;

    console.log("Group created", testGroup.id);
    expect(testGroup.id).toBeDefined();

    // Send a test message
    const testMessage = `Test message at ${new Date().toISOString()}`;
    await testGroup.send(testMessage);
    console.log("Test message sent to group:", testMessage);

    // Allow time for message to propagate
    await sleep(1000);

    // Test client-level conversations.sync()
    const jackClient = workers.get("jack")!.client;
    await jackClient.conversations.sync();

    // Verify we can retrieve the group and messages
    const group = await jackClient.conversations.getConversationById(
      testGroup.id,
    );
    expect(group).toBeDefined();

    const messages = await group!.messages();
    console.log(
      `Retrieved ${messages.length} messages after client.conversations.sync()`,
    );
    expect(messages.length).toBeGreaterThan(0);
  });

  it("test sync - individual conversation.sync()", async () => {
    // Test individual conversation sync
    const ivyClient = workers.get("ivy")!.client;

    // Get the group conversation
    const group = await ivyClient.conversations.getConversationById(
      testGroup.id,
    );
    expect(group).toBeDefined();

    // Test individual conversation sync
    await group!.sync();

    // Retrieve messages after sync
    const messages = await group!.messages();
    console.log(
      `Retrieved ${messages.length} messages after conversation.sync()`,
    );
    expect(messages.length).toBeGreaterThan(0);
  });
});
