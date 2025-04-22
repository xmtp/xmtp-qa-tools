import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceResult, sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyStreamAll } from "@helpers/streams";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroup,
  performGroupOperations,
  TEST_CONFIGS,
  testMessageStreaming,
} from "@helpers/stress";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { Dm, Group } from "@xmtp/node-sdk";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "stress";
loadEnv(testName);

// Choose which test size to run
const testSize = process.env.STRESS_SIZE || "small";
const config = TEST_CONFIGS[testSize];

console.log(`Running ${testSize} stress test with configuration:`, config);

describe(testName, () => {
  let workers: WorkerManager;
  let start: number;
  let hasFailures: boolean = false;

  beforeAll(async () => {
    try {
      // Initialize the workers
      workers = await getWorkers(config.workerCount, testName, "message", "gm");
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(config.workerCount);
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

  afterEach(function () {
    try {
      sendPerformanceResult(expect, workers, start);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Create a DM between two workers
  it("createAndSendDms: should create DMs and send messages", async () => {
    try {
      const dm = await createAndSendDms(workers, config.messageCount);

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();

      // Verify the receiver got the messages
      const receiver = workers.getWorkers()[1];
      const conversations = await receiver.client.conversations.list();
      const receivedDm = conversations.find(
        (c: Dm | Group) =>
          c.id === dm.id &&
          c instanceof Dm &&
          c.peerInboxId.toLowerCase() ===
            workers.getWorkers()[0].client.inboxId.toLowerCase(),
      );

      expect(receivedDm).toBeDefined();

      const messages = await receivedDm!.messages();
      expect(messages.length).toBeGreaterThanOrEqual(config.messageCount);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Create a small group with worker members
  it("createAndSendInGroup: should create a group and send messages", async () => {
    try {
      const group = await createAndSendInGroup(workers, config.messageCount);

      expect(group).toBeDefined();
      expect(group.id).toBeDefined();

      // Verify group membership
      const members = await group.members();
      const allInboxIds = workers.getWorkers().map((w) => w.client.inboxId);
      expect(members.length).toBe(allInboxIds.length + 1); // +1 for the creator

      // Verify the messages were received by another worker
      const receiver = workers.getWorkers()[1];
      await receiver.client.conversations.sync();

      const receiverConversations = await receiver.client.conversations.list();
      const receivedGroup = receiverConversations.find(
        (c) => c instanceof Group && c.id === group.id,
      ) as Group;

      expect(receivedGroup).toBeDefined();

      const receivedMessages = await receivedGroup.messages();
      expect(receivedMessages.length).toBeGreaterThanOrEqual(
        config.messageCount,
      );
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Create a large group
  it("createLargeGroup: should create a large group with many members", async () => {
    try {
      const creator = workers.getWorkers()[0];
      const memberCount = config.largeGroups[0] || 50;

      const group = await createLargeGroup(creator.client, memberCount);

      // Ensure group is created
      expect(group).toBeDefined();

      if (group) {
        // Get the actual member count
        const members = await group.members();
        console.log(
          `Created group with ${members.length} members, ID: ${group.id}`,
        );

        // For large groups, we might not get all members added if some operations fail
        expect(members.length).toBeGreaterThan(0);
      }
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Test group operations: update name, add/remove members, admin operations
  it("groupOperations: should perform various group operations", async () => {
    try {
      const group = await performGroupOperations(workers);

      expect(group).toBeDefined();
      expect(group.id).toBeDefined();

      // Verify group name was updated
      expect(group.name).toContain("Updated Group");

      // Verify description was updated
      expect(group.description).toBe("Updated description");

      // Verify member was made admin
      const memberToPromote = workers.getWorkers()[1];
      expect(group.isAdmin(memberToPromote.client.inboxId)).toBe(true);

      // Verify member was removed
      const memberToRemove = workers.getWorkers()[2];
      const members = await group.members();
      const removedMemberFound = members.some(
        (m) =>
          m.inboxId.toLowerCase() ===
          memberToRemove.client.inboxId.toLowerCase(),
      );
      expect(removedMemberFound).toBe(false);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Test message streaming
  it("messageStreaming: should stream messages in real time", async () => {
    try {
      const receivedMessages = await testMessageStreaming(workers);
      expect(receivedMessages).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Test for conversation consensus
  it("verifyStreamAll: should verify message consensus across all workers", async () => {
    try {
      const creator = workers.getWorkers()[0];
      const memberInboxIds = workers
        .getWorkers()
        .slice(1)
        .map((w) => w.client.inboxId);

      // Create a group
      const group = await creator.client.conversations.newGroup(
        memberInboxIds,
        {
          groupName: `Consensus Group ${Date.now()}`,
          groupDescription: "Test group for consensus testing",
        },
      );

      // Send a test message
      const testMessage = `Consensus test message ${Date.now()}`;
      await group.send(testMessage);

      // Verify all workers received the message
      const verifyResult = await verifyStreamAll(group, workers);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
