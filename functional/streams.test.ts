import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  createGroupConsentSender,
  verifyConsentStream,
  verifyConversationStream,
  verifyGroupUpdateStream,
  verifyMessageStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
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
      const verifyResult = await verifyMessageStream(newDm, [
        workers.get("randomguy")!,
      ]);

      console.log("verifyResult", JSON.stringify(verifyResult));
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
      const verifyResult = await verifyGroupUpdateStream(group as Group, [
        workers.get("randomguy")!,
      ]);

      console.log("verifyResult", JSON.stringify(verifyResult));
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyConsentStream: manage consent for all members in a group", async () => {
    workers = await getWorkers(names, testName, typeofStream.Consent);

    try {
      const groupConsentSender = createGroupConsentSender(
        workers.get("henry")!, // henry is doing the consent update
        group.id, // for this group
        workers.get("randomguy")!.client.inboxId, // blocking randomguy
        true, // block the entities
      );

      const consentAction = async () => {
        await groupConsentSender();
      };

      console.log("Starting consent verification process");

      const verifyResult = await verifyConsentStream(
        workers.get("henry")!,
        [workers.get("randomguy")!],
        consentAction,
      );

      console.log("verifyResult", JSON.stringify(verifyResult));
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = true;
      console.error("Test failed:", e);
      throw e;
    }
  });
});
