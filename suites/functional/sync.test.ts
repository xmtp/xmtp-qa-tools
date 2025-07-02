import { sleep } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "sync-comparison";

describe(testName, async () => {
  let workers: WorkerManager;
  let testGroup: Group;

  // Define test workers
  const testWorkers = ["henry", "ivy", "jack", "karen", "larry"];
  workers = await getWorkers(testWorkers);

  setupTestLifecycle({ testName, expect });

  it("should establish test environment by creating group with all participants", async () => {
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
      testGroup = (await workers
        .get("henry")!
        .client.conversations.newGroup(memberInboxIds, {
          groupName: "Sync Test Group",
          groupDescription: "Group for testing sync methods",
        })) as Group;

      console.log("Group created", testGroup.id);
      expect(testGroup.id).toBeDefined();

      // Verify group creation
      await testGroup.sync();
      const members = await testGroup.members();
      expect(members.length).toBe(testWorkers.length);

      // Allow time for message to propagate to all members
      await sleep(1000);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should send baseline message to group for synchronization performance testing", async () => {
    try {
      // Sync Ivy's conversations first to ensure the group is visible
      const ivyClient = workers.get("ivy")!.client;
      await ivyClient.conversations.sync();

      const groupForIvy = (await ivyClient.conversations.getConversationById(
        testGroup.id,
      )) as Group;
      expect(groupForIvy).toBeDefined();

      // Ensure the group is properly synced
      await groupForIvy.sync();

      const testMessage = `Test message at ${new Date().toISOString()}`;
      await groupForIvy.send(testMessage);
      console.log("Test message sent to group:", testMessage);

      // Allow time for message to propagate to all members
      await sleep(1000);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should measure performance impact of client-level conversations.sync() operation", async () => {
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

      // Ensure the group is fully synced
      await group!.sync();

      // Retrieve messages after sync
      const messages = await group!.messages();
      console.log(
        `Retrieved ${messages.length} messages after client.conversations.sync()`,
      );
      expect(messages.length).toBeGreaterThan(0);

      return { syncTime, messageCount: messages.length };
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should measure performance impact of individual conversation.sync() operation", async () => {
    try {
      const karenClient = workers.get("karen")!.client;

      // First do a more thorough client sync to make sure we have the conversation
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
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should measure message retrieval performance without explicit synchronization", async () => {
    try {
      const larryClient = workers.get("larry")!.client;

      // Do an initial sync to ensure we have the conversation
      await larryClient.conversations.sync();

      // Get the group conversation without any additional sync
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
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
