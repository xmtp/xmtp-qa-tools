import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyConversationStream, verifyStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Conversation,
} from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, async () => {
  // Test variables
  let hasFailures = false;
  let start: number;
  let testStart: number;
  let group: Conversation;
  const names = ["henry", "randomguy", "bob", "alice", "dave"];
  let workers = await getWorkers(names, testName, typeofStream.None);

  // Setup test lifecycle
  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  // Create a group before all tests
  beforeAll(async () => {
    // Initialize workers
    group = await workers
      .get("henry")!
      .client.conversations.newGroup([
        workers.get("randomguy")!.client.inboxId,
        workers.get("bob")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
        workers.get("dave")!.client.inboxId,
      ]);
  });

  it("verifyConversationStream: should create a new conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);

      console.log("Testing conversation stream with new DM creation");

      // Use the dedicated conversation stream verification helper
      const result = await verifyConversationStream(workers.get("henry")!, [
        workers.get("randomguy")!,
      ]);

      console.log("Conversation stream test results:", JSON.stringify(result));

      // Assert that we received the conversation notification
      expect(result.receivedCount).toBeGreaterThan(0);
      expect(result.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("verifyMessageStream: should measure receiving a gm", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);
      // Create direct message
      const newDm = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      // Verify message delivery
      const verifyResult = await verifyStream(
        newDm,
        [workers.get("randomguy")!],
        typeofStream.Message,
      );

      // Assert results
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyGroupMetadataStream: should update group name", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.GroupUpdated);
      const verifyResult = await verifyStream(
        group,
        [workers.get("randomguy")!],
        typeofStream.GroupUpdated,
      );

      // Assert results
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
