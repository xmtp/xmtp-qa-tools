import { logError } from "@helpers/logger";
import { verifyConversationStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "conversationListStreaming";

describe(testName, async () => {
  // Initialize workers with version testing enabled
  const workers = await getWorkers(["alice", "bob", "charlie"]);

  setupTestLifecycle({});

  it("should stream conversation list updates when new conversations are created", async () => {
    try {
      // Start conversation stream on alice to monitor new conversation events
      workers.get("alice")!.worker.startStream(typeofStream.Conversation);

      // Bob creates a DM with alice
      const dm = await workers
        .get("bob")!
        .client.conversations.newDmWithIdentifier({
          identifier: workers.get("alice")!.address,
          identifierKind: IdentifierKind.Ethereum,
        });

      // Charlie creates a group that includes alice
      const group = await workers
        .get("charlie")!
        .client.conversations.newGroup([workers.get("alice")!.client.inboxId]);

      // Verify that alice receives conversation creation notifications
      const verifyResult = await verifyConversationStream(
        workers.get("bob")!, // DM initiator
        [workers.get("alice")!], // receiver who should get notifications
      );

      expect(verifyResult.allReceived).toBe(true);
      expect(verifyResult.averageEventTiming).toBeLessThan(1000); // Should be fast
      expect(dm).toBeDefined();
      expect(group).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should stream multiple conversation creation events to all participants", async () => {
    try {
      // Start conversation streams on both alice and bob
      workers.get("alice")!.worker.startStream(typeofStream.Conversation);
      workers.get("bob")!.worker.startStream(typeofStream.Conversation);

      // Charlie creates a group including both alice and bob
      const verifyResult = await verifyConversationStream(
        workers.get("charlie")!, // group creator
        [workers.get("alice")!, workers.get("bob")!], // receivers
      );

      expect(verifyResult.allReceived).toBe(true);
      expect(verifyResult.averageEventTiming).toBeLessThan(1000);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should maintain conversation list streaming performance under load", async () => {
    try {
      // Start conversation stream on alice
      workers.get("alice")!.worker.startStream(typeofStream.Conversation);

      // Test multiple rapid conversation creations
      for (let i = 0; i < 3; i++) {
        const verifyResult = await verifyConversationStream(
          workers.get("bob")!,
          [workers.get("alice")!],
        );

        expect(verifyResult.allReceived || verifyResult.almostAllReceived).toBe(
          true,
        );
        expect(verifyResult.averageEventTiming).toBeLessThan(2000);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
