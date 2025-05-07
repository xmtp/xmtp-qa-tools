import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  createDmConsentSender,
  createGroupConsentSender,
  verifyStream,
} from "@helpers/streams";
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

  it("receiveGM: should measure receiving a gm", async () => {
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

  it("receiveGroupMetadata: should update group name", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);
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

  it("receiveGroupConsent: should receive group consent stream events", async () => {
    try {
      // Initialize workers with consent stream type
      const workers = await getWorkers(names, testName, typeofStream.Consent);

      // Create a simple consent handler that blocks the group
      const consentSender = async (
        conversation: Conversation,
        _payload: string,
      ): Promise<string> => {
        // Toggle group consent state
        await workers.get("henry")!.client.preferences.setConsentStates([
          {
            entity: group.id,
            entityType: ConsentEntityType.GroupId,
            state: ConsentState.Denied,
          },
        ]);
        return "consent_updated";
      };

      // Verify that we get consent events through the stream
      const verifyResult = await verifyStream(
        group,
        [workers.get("henry")!],
        typeofStream.Consent,
        1,
        (i, suffix) => `consent_update_${i}_${suffix}`,
        consentSender,
        () => {
          console.log("Group consent update initiated, starting timer");
          start = performance.now();
        },
      );

      // Log results for debugging
      console.log(
        "Received consent stream events:",
        JSON.stringify(verifyResult.messages, null, 2),
      );

      // Just verify we received an event through the stream
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);

      // Always reset consent to a known state to avoid affecting other tests
      await workers.get("henry")!.client.preferences.setConsentStates([
        {
          entity: group.id,
          entityType: ConsentEntityType.GroupId,
          state: ConsentState.Allowed,
        },
      ]);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("receiveDmConsent: should receive DM consent stream events", async () => {
    try {
      // Initialize workers with consent stream type
      const workers = await getWorkers(names, testName, typeofStream.Consent);

      // Create a DM for testing
      const dmConversation = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      // Create a simple consent handler that allows DM
      const dmConsentSender = async (
        conversation: Conversation,
        _payload: string,
      ): Promise<string> => {
        // Set consent state to allowed for the DM
        await workers.get("henry")!.client.preferences.setConsentStates([
          {
            entity: workers.get("randomguy")!.client.inboxId,
            entityType: ConsentEntityType.InboxId,
            state: ConsentState.Allowed,
          },
        ]);
        return "dm_consent_updated";
      };

      // Test the stream to verify it receives events
      const verifyResult = await verifyStream(
        dmConversation,
        [workers.get("henry")!],
        typeofStream.Consent,
        1,
        (i, suffix) => `dm_consent_update_${i}_${suffix}`,
        dmConsentSender,
        () => {
          console.log("DM consent update initiated, starting timer");
          start = performance.now();
        },
      );

      // Log results for debugging
      console.log(
        "Received DM consent stream events:",
        JSON.stringify(verifyResult.messages, null, 2),
      );

      // Just verify we received an event through the stream
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // it("receiveGroupConversation: should create a new conversation", async () => {
  //   try {
  //     const validHexPayload = workers.get("randomguy")!.client.inboxId;

  //     const verifyResult = await verifyStream(
  //       group,
  //       [workers.get("henry")!],
  //       typeofStream.Conversation,
  //       1,
  //       () => validHexPayload,
  //     );

  //     console.log(
  //       `[${workers.get("henry")!.name}] Received new conversation notification:`,
  //     );
  //     verifyResult.messages.forEach((receiverMessages) => {
  //       console.log(
  //         `  New conversation ID: ${JSON.stringify(receiverMessages)}`,
  //       );
  //     });

  //     expect(verifyResult.allReceived).toBe(true);
  //   } catch (e) {
  //     hasFailures = logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });
});
