import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  createGroupConsentSender,
  verifyConsentStream,
  verifyConversationGroupStream,
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
  let start: number;
  let testStart: number;
  let group: Group;
  const names = ["henry", "randomguy", "bob", "alice", "dave"];
  let workers = await getWorkers(names, testName, typeofStream.None);

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

  // Create a group before all tests
  beforeAll(async () => {
    // Initialize workers
    group = await workers.getWorkers()[0].client.conversations.newGroup([]);
  });

  it("verifyConversationStream: should create a new conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);

      console.log("Testing conversation stream with new DM creation");

      // Use the dedicated conversation stream verification helper
      const verifyResult = await verifyConversationStream(
        workers.getWorkers()[0],
        [workers.get("randomguy")!],
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("verifyConversationGroupStream: should create a add members to a conversation", async () => {
    try {
      // Initialize fresh workers specifically for conversation stream testing
      workers = await getWorkers(names, testName, typeofStream.Conversation);

      // Use the dedicated conversation stream verification helper with 80% success threshold
      const verifyResult = await verifyConversationGroupStream(
        group,
        workers.getWorkers(),
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
      const newDm = await workers
        .getWorkers()[0]
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        newDm,
        [workers.get("randomguy")!],
        10,
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyMessageGroupStream: should measure receiving a gm", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        group,
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
      const verifyResult = await verifyGroupUpdateStream(group, [
        workers.get("randomguy")!,
      ]);

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyConsentStream: manage consent for all members in a group", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Consent);

      const groupConsentSender = createGroupConsentSender(
        workers.getWorkers()[0], // henry is doing the consent update
        group.id, // for this group
        workers.get("randomguy")!.client.inboxId, // blocking randomguy
        true, // block the entities
      );

      const consentAction = async () => {
        await groupConsentSender();
      };

      console.log("Starting consent verification process");

      const verifyResult = await verifyConsentStream(
        workers.getWorkers()[0],
        [workers.get("randomguy")!],
        consentAction,
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
