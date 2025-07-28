import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers: WorkerManager;
  let testGroup: Group;

  workers = await getWorkers(5);

  it("sync: client.conversations.sync()", async () => {
    console.log("Creating test group with", workers.getAll().length, "members");
    testGroup = await workers.createGroupBetweenAll();

    console.log("Group created", testGroup.id);
    expect(testGroup.id).toBeDefined();

    // Send a test message
    const testMessage = `Test message at ${new Date().toISOString()}`;
    await testGroup.send(testMessage);
    console.log("Test message sent to group:", testMessage);

    // Test client-level conversations.sync()
    const jackClient = workers.getCreator();
    await jackClient.client.conversations.sync();

    // we can retrieve the group and messages
    const group = await jackClient.client.conversations.getConversationById(
      testGroup.id,
    );
    expect(group).toBeDefined();

    const messages = await group!.messages();
    console.log(
      `Retrieved ${messages.length} messages after client.conversations.sync()`,
    );
    expect(messages.length).toBeGreaterThan(0);
  });

  it("group sync: individual conversation.sync()", async () => {
    // Test individual conversation sync
    const ivyClient = workers.getCreator();

    // Get the group conversation
    const group = await ivyClient.client.conversations.getConversationById(
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

  it("syncall: client.conversations.sync()", async () => {
    const henryClient = workers.getCreator();

    // Measure time to sync all conversations
    const syncStartTime = performance.now();
    await henryClient.client.conversations.sync();
    const syncEndTime = performance.now();
    const syncTime = syncEndTime - syncStartTime;

    console.log(`Time to sync all conversations: ${syncTime}ms`);

    // we can retrieve the group
    const group = await henryClient.client.conversations.getConversationById(
      testGroup.id,
    );
    expect(group).toBeDefined();

    // Measure time to retrieve messages
    const messagesStartTime = performance.now();
    const messages = await group!.messages();
    const messagesEndTime = performance.now();
    const messagesTime = messagesEndTime - messagesStartTime;

    console.log(`Time to retrieve messages: ${messagesTime}ms`);
    console.log(`Total sync + messages time: ${syncTime + messagesTime}ms`);
    console.log(`Retrieved ${messages.length} messages`);

    expect(messages.length).toBeGreaterThan(0);
  });
});
