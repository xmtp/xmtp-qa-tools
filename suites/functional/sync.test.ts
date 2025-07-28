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

  // Define test workers - need more for DM test
  const testWorkers = ["henry", "ivy", "jack", "karen", "larry"];
  workers = await getWorkers(testWorkers);

  it("sync: client.conversations.sync()", async () => {
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

    // we can retrieve the group and messages
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

  it("group sync: individual conversation.sync()", async () => {
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

  it("syncall: client.conversations.sync()", async () => {
    const henryClient = workers.get("henry")!.client;

    // Measure time to sync all conversations
    const syncStartTime = performance.now();
    await henryClient.conversations.sync();
    const syncEndTime = performance.now();
    const syncTime = syncEndTime - syncStartTime;

    console.log(`Time to sync all conversations: ${syncTime}ms`);

    // we can retrieve the group
    const group = await henryClient.conversations.getConversationById(
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

  it("dmsync: DM sync with multiple installations", async () => {
    const senderClient = workers.get("henry")!.client;
    const receiverClient = workers.get("ivy")!.client;

    // Create first DM from installation A
    const dm1 = await senderClient.conversations.newDm(receiverClient.inboxId);
    const message1 = `DM1 message at ${new Date().toISOString()}`;
    await dm1.send(message1);
    console.log("Sent DM1:", message1);

    // Create second DM from installation B (same sender, different installation)
    const dm2 = await senderClient.conversations.newDm(receiverClient.inboxId);
    const message2 = `DM2 message at ${new Date().toISOString()}`;
    await dm2.send(message2);
    console.log("Sent DM2:", message2);

    // Allow time for messages to propagate
    await sleep(1000);

    // Sync on receiving side
    const syncStartTime = performance.now();
    await receiverClient.conversations.sync();
    const syncEndTime = performance.now();
    const syncTime = syncEndTime - syncStartTime;

    console.log(`Time to sync DMs: ${syncTime}ms`);

    // Get all conversations for receiver
    const conversations = await receiverClient.conversations.list();
    const dmConversations = conversations.filter(
      (conv) => conv.id !== testGroup.id,
    );

    console.log(`Found ${dmConversations.length} DM conversations after sync`);

    // both DMs are synced
    expect(dmConversations.length).toBeGreaterThanOrEqual(2);

    // Check messages in each DM
    for (const dm of dmConversations.slice(0, 2)) {
      const messages = await dm.messages();
      console.log(`DM ${dm.id}: ${messages.length} messages`);
      expect(messages.length).toBeGreaterThan(0);
    }
  });
});
