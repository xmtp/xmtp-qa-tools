import { logError } from "@helpers/logger";
import {
  verifyAddMemberStream,
  verifyConsentStream,
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
  verifyNewConversationStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("streams", async () => {
  let group: Group;
  let workers = await getWorkers(5);

  // Setup test lifecycle
  setupTestLifecycle({});

  it("membership stream", async () => {
    try {
      // Initialize workers
      group = await workers.createGroupBetweenAll();

      const verifyResult = await verifyMembershipStream(
        group,
        workers.getAllButCreator(),
        getInboxIds(1),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("consent stream", async () => {
    try {
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

  it("dm stream", async () => {
    try {
      // Create direct message
      const creator = workers.getCreator();
      const receiver = workers.getReceiver();
      const newDm = await creator.client.conversations.newDm(
        receiver.client.inboxId,
      );

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        newDm as Dm,
        [receiver],
        10,
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("add member stream", async () => {
    try {
      const creator = workers.getCreator();
      const receiver = workers.getReceiver();
      // Create group with alice as the creator
      group = (await creator.client.conversations.newGroup([
        receiver.client.inboxId,
      ])) as Group;
      console.log("Group created", group.id);

      const addMembers = getInboxIds(1);
      const verifyResult = await verifyAddMemberStream(
        group,
        [receiver],
        addMembers,
      );
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("message stream", async () => {
    try {
      const newGroup = await workers.createGroupBetweenAll();

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

  it("metadata stream", async () => {
    try {
      // Initialize workers
      group = await workers.createGroupBetweenAll();

      const verifyResult = await verifyMetadataStream(
        group,
        workers.getAllButCreator(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("conversation stream", async () => {
    try {
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

  it("new conversation stream", async () => {
    try {
      group = (await workers
        .getCreator()
        .client.conversations.newGroup([])) as Group;

      // Use the dedicated conversation stream verification helper with 80% success threshold
      const verifyResult = await verifyNewConversationStream(
        group,
        workers.getAllButCreator(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
