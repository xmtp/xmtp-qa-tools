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
      .getWorkers()[0]
      .client.conversations.newGroup([
        workers.get("randomguy")!.client.inboxId,
        workers.get("bob")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
        workers.get("dave")!.client.inboxId,
      ]);
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

      console.log("verifyResult", JSON.stringify(verifyResult));
      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("verifyMessageGroupStream: should measure receiving a gm", async () => {
    try {
      workers = await getWorkers(names, testName, typeofStream.Message);
      // Create direct message
      const newGroup = await workers
        .getWorkers()[0]
        .client.conversations.newGroup(
          workers.getWorkers().map((w) => w.client.inboxId),
        );

      // Verify message delivery
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getWorkers(),
        10,
      );

      console.log("verifyResult", JSON.stringify(verifyResult));
      expect(verifyResult.messages.length).toEqual(workers.getLength());
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // it("verifyConversationStream: should create a new conversation", async () => {
  //   try {
  //     // Initialize fresh workers specifically for conversation stream testing
  //     workers = await getWorkers(names, testName, typeofStream.Conversation);

  //     console.log("Testing conversation stream with new DM creation");

  //     // Use the dedicated conversation stream verification helper
  //     const verifyResult = await verifyConversationStream(
  //       workers.getWorkers()[0],
  //       [workers.get("randomguy")!],
  //     );

  //     console.log("verifyResult", JSON.stringify(verifyResult));
  //     expect(verifyResult.allReceived).toBe(true);
  //   } catch (e) {
  //     hasFailures = logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });
  // it("verifyConversationGroupStream: should create a new conversation", async () => {
  //   try {
  //     // Initialize fresh workers specifically for conversation stream testing
  //     workers = await getWorkers(names, testName, typeofStream.Conversation);

  //     console.log("Testing conversation stream with adding members");
  //     const newGroup = await workers
  //       .getWorkers()[0]
  //       .client.conversations.newGroup([]);
  //     // Use the dedicated conversation stream verification helper
  //     const verifyResult = await verifyConversationGroupStream(
  //       newGroup,
  //       workers.getWorkers()[0],
  //       workers.getWorkers(),
  //     );

  //     console.log("verifyResult", JSON.stringify(verifyResult));
  //     expect(verifyResult.allReceived).toBe(true);
  //   } catch (e) {
  //     hasFailures = logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });

  // it("verifyGroupMetadataStream: should update group name", async () => {
  //   try {
  //     workers = await getWorkers(names, testName, typeofStream.GroupUpdated);
  //     const verifyResult = await verifyGroupUpdateStream(group as Group, [
  //       workers.get("randomguy")!,
  //     ]);

  //     console.log("verifyResult", JSON.stringify(verifyResult));
  //     expect(verifyResult.messages.length).toEqual(1);
  //     expect(verifyResult.allReceived).toBe(true);
  //   } catch (e) {
  //     hasFailures = logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });

  // it("verifyConsentStream: manage consent for all members in a group", async () => {
  //   workers = await getWorkers(names, testName, typeofStream.Consent);

  //   try {
  //     const groupConsentSender = createGroupConsentSender(
  //       workers.getWorkers()[0], // henry is doing the consent update
  //       group.id, // for this group
  //       workers.get("randomguy")!.client.inboxId, // blocking randomguy
  //       true, // block the entities
  //     );

  //     const consentAction = async () => {
  //       await groupConsentSender();
  //     };

  //     console.log("Starting consent verification process");

  //     const verifyResult = await verifyConsentStream(
  //       workers.getWorkers()[0],
  //       [workers.get("randomguy")!],
  //       consentAction,
  //     );

  //     console.log("verifyResult", JSON.stringify(verifyResult));
  //     expect(verifyResult.messages.length).toEqual(1);
  //     expect(verifyResult.allReceived).toBe(true);
  //   } catch (e) {
  //     hasFailures = true;
  //     console.error("Test failed:", e);
  //     throw e;
  //   }
  // });
});
