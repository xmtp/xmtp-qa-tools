import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const testName = "sync-comparison";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  let start: number;
  let testGroup: Group;

  // Define test workers
  const testWorkers = [
    "henry", // Group creator
    "ivy", // Message sender
    "jack", // Test sync at client level
    "karen", // Test sync at conversation level
    "larry", // Test messages without sync
  ];

  beforeAll(async () => {
    try {
      workers = await getWorkers(testWorkers, testName);
      expect(workers).toBeDefined();
      expect(workers.getLength()).toBe(testWorkers.length);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  it("should create a test group with all participants", async () => {
    try {
      // Create a group with all test workers
      const memberInboxIds = testWorkers
        .filter((name) => name !== "henry") // Exclude creator from the members list
        .map((name) => workers.get(name)!.client.inboxId);

      console.log(
        "Creating test group with",
        memberInboxIds.length,
        "participants",
      );
      testGroup = await workers
        .get("henry")!
        .client.conversations.newGroup(memberInboxIds, {
          groupName: "Sync Test Group",
          groupDescription: "Group for testing sync methods",
        });

      console.log("Group created", testGroup.id);
      expect(testGroup.id).toBeDefined();

      // Verify group creation
      await testGroup.sync();
      const members = await testGroup.members();
      expect(members.length).toBe(testWorkers.length);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should send a message to the group for testing sync methods", async () => {
    try {
      // Send a message from ivy to the group
      const ivyClient = workers.get("ivy")!.client;
      const groupForIvy = (await ivyClient.conversations.getConversationById(
        testGroup.id,
      )) as Group;
      expect(groupForIvy).toBeDefined();

      const testMessage = `Test message at ${new Date().toISOString()}`;
      await groupForIvy.send(testMessage);
      console.log("Test message sent to group:", testMessage);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should measure performance of client.conversations.sync()", async () => {
    try {
      const jackClient = workers.get("jack")!.client;

      // Measure time to sync all conversations
      const syncStartTime = performance.now();
      await jackClient.conversations.sync();
      const syncEndTime = performance.now();
      const syncTime = syncEndTime - syncStartTime;

      console.log(`Time to sync all conversations: ${syncTime}ms`);

      // Verify we can retrieve the group
      const group = await jackClient.conversations.getConversationById(
        testGroup.id,
      );
      expect(group).toBeDefined();

      // Retrieve messages after sync
      const messages = await group!.messages();
      console.log(
        `Retrieved ${messages.length} messages after client.conversations.sync()`,
      );
      expect(messages.length).toBeGreaterThan(0);

      return { syncTime, messageCount: messages.length };
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should measure performance of individual conversation sync()", async () => {
    try {
      const karenClient = workers.get("karen")!.client;

      // First do a quick client sync to make sure we have the conversation
      await karenClient.conversations.sync();

      // Get the group conversation
      const group = await karenClient.conversations.getConversationById(
        testGroup.id,
      );
      expect(group).toBeDefined();

      // Measure time to sync just this conversation
      const syncStartTime = performance.now();
      await group!.sync();
      const syncEndTime = performance.now();
      const syncTime = syncEndTime - syncStartTime;

      console.log(`Time to sync single conversation: ${syncTime}ms`);

      // Retrieve messages after sync
      const messages = await group!.messages();
      console.log(
        `Retrieved ${messages.length} messages after conversation.sync()`,
      );
      expect(messages.length).toBeGreaterThan(0);

      return { syncTime, messageCount: messages.length };
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should test retrieving messages without explicit sync", async () => {
    try {
      const larryClient = workers.get("larry")!.client;

      // Get the group conversation without any initial sync
      const startTime = performance.now();
      const group = await larryClient.conversations.getConversationById(
        testGroup.id,
      );
      expect(group).toBeDefined();

      // Try to retrieve messages without any sync
      const messages = await group!.messages();
      const endTime = performance.now();
      const retrievalTime = endTime - startTime;

      console.log(
        `Time to retrieve messages without explicit sync: ${retrievalTime}ms`,
      );
      console.log(
        `Retrieved ${messages.length} messages without explicit sync`,
      );

      // We don't expect messages here, but the API call should at least not fail

      return { retrievalTime, messageCount: messages.length };
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
