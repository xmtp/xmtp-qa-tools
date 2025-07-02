import {
  verifyConsentStream,
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("streams", async () => {
  const workers = await getWorkers(["alice", "bob", "charlie", "dave", "eve"]);
  setupTestLifecycle({});

  it("should verify message streams in DM", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Message);

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    const verifyResult = await verifyMessageStream(dm, [bob], 5);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should verify message streams in group", async () => {
    workers.getAllButCreator().forEach((worker) => {
      worker.worker.startStream(typeofStream.Message);
    });

    const group = await workers.createGroupBetweenAll("Stream Test Group");

    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      3,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should verify metadata update streams", async () => {
    workers.getAllButCreator().forEach((worker) => {
      worker.worker.startStream(typeofStream.GroupUpdated);
    });

    const group = await workers.createGroupBetweenAll("Metadata Test Group");

    const verifyResult = await verifyMetadataStream(
      group,
      workers.getAllButCreator(),
      2,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should verify membership update streams", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;
    const charlie = workers.get("charlie")!;

    bob.worker.startStream(typeofStream.GroupUpdated);

    const group = await alice.client.conversations.newGroup([
      bob.client.inboxId,
    ]);

    const verifyResult = await verifyMembershipStream(
      group,
      [bob],
      [charlie.client.inboxId],
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should verify conversation creation streams", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Conversation);

    const verifyResult = await verifyConversationStream(alice, [bob]);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should verify consent state streams", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Consent);

    const verifyResult = await verifyConsentStream(alice, bob);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should handle multiple concurrent streams", async () => {
    const alice = workers.get("alice")!;
    const receivers = workers.getAllButCreator();

    receivers.forEach((worker) => {
      worker.worker.startStream(typeofStream.Message);
      worker.worker.startStream(typeofStream.GroupUpdated);
    });

    const group = await workers.createGroupBetweenAll("Concurrent Test");

    const messageResult = await verifyMessageStream(group, receivers, 2);
    const metadataResult = await verifyMetadataStream(group, receivers, 1);

    expect(messageResult.allReceived).toBe(true);
    expect(metadataResult.allReceived).toBe(true);
  });

  it("should maintain stream performance under load", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Message);

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    const verifyResult = await verifyMessageStream(dm, [bob], 10);
    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.averageEventTiming).toBeLessThan(2000);
  });
});
