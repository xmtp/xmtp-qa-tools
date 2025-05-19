import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import {
  verifyConsentStream,
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
  verifyNewConversationStream,
} from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, async () => {
  let group: Conversation;
  const names = getRandomNames(5);
  let workers = await getWorkers(names, testName);

  // Setup test lifecycle
  setupTestLifecycle({
    expect,
  });

  it("verifyConsentStream: manage consent for all members in a group", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Consent);

      const verifyResult = await verifyConsentStream(
        workers.getCreator(),
        workers.getReceiver(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("verifyMessageStream: should measure receiving a gm", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);
      // Create direct message
      const creator = workers.getCreator();
      const receiver = workers.getReceiver();
      const newDm = await creator.client.conversations.newDm(
        receiver.client.inboxId,
      );

      // Verify message delivery
      const verifyResult = await verifyMessageStream(newDm, [receiver], 10);

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyMessageGroupStream: should measure receiving a gm", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);
      const newGroup = await workers.createGroup();

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
        10,
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyGroupMetadataStream: should update group name", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.GroupUpdated);
      // Initialize workers
      group = await workers.createGroup();

      const verifyResult = await verifyMetadataStream(
        group as Group,
        workers.getAllButCreator(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyAddMembersStream: should add members to a group", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.GroupUpdated);
      // Initialize workers
      group = await workers.createGroup();

      const verifyResult = await verifyMembershipStream(
        group as Group,
        workers.getAllButCreator(),
        [generatedInboxes[0].inboxId],
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("verifyConversationStream: should create a new conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);

      // Use the dedicated conversation stream verification helper
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        [workers.getReceiver()],
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyNewConversationStream: should create a add members to a conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);
      group = await workers.getCreator().client.conversations.newGroup([]);

      // Use the dedicated conversation stream verification helper with 80% success threshold
      const verifyResult = await verifyNewConversationStream(
        group as Group,
        workers.getAllButCreator(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
