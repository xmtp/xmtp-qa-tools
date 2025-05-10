import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  verifyAddMembersStream,
  verifyConsentStream,
  verifyConversationStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, async () => {
  let start: number;
  let testStart: number;
  let group: Conversation;
  const names = getRandomNames(5);
  let workers = await getWorkers(names, testName);

  // Setup test lifecycle
  setupTestLifecycle({
    expect,
    workers,
    testName,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
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
      const creator = workers.getCreator();
      const newGroup = await creator.client.conversations.newGroup(
        workers.getAllButCreator().map((w) => w.client.inboxId),
      );

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getWorkers(),
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
      group = await workers
        .getCreator()
        .client.conversations.newGroup(
          workers.getAllButCreator().map((w) => w.client.inboxId),
        );

      const verifyResult = await verifyMetadataStream(
        group as Group,
        workers.getWorkers(),
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

  it("verifyAddMembersStream: should create a add members to a conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);
      group = await workers.getCreator().client.conversations.newGroup([]);

      // Use the dedicated conversation stream verification helper with 80% success threshold
      const verifyResult = await verifyAddMembersStream(
        group as Group,
        workers.getWorkers(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
