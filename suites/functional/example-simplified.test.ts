import {
  measureOperationTime,
  runBatchOperations,
  setupSimplifiedDmTest,
  setupSimplifiedGroupTest,
} from "@helpers/test-simplification";
import { setupTestLifecycle } from "@helpers/vitest";
import { describe, expect, it } from "vitest";

const testName = "example-simplified";

describe(testName, () => {
  setupTestLifecycle({ testName });

  it("should demonstrate simplified group testing", async () => {
    // Single line setup replaces 10+ lines of boilerplate
    const {
      group,
      sendAndVerifyMessage,
      addMember,
      removeMember,
      updateGroupDetails,
    } = await setupSimplifiedGroupTest({
      testName,
      workerNames: ["alice", "bob", "charlie"],
      useVersions: false,
    });

    // Simplified operations with built-in verification
    expect(group.id).toBeDefined();

    // Update group details in one call
    await updateGroupDetails("Test Group", "A simplified test group");
    expect(group.name).toBe("Test Group");
    expect(group.description).toBe("A simplified test group");

    // Send and verify message in one call
    const messageDelivered = await sendAndVerifyMessage(
      "Hello simplified world!",
    );
    expect(messageDelivered).toBe(true);

    // Member management with automatic sync
    await addMember("dave");
    const membersAfterAdd = await group.members();
    expect(membersAfterAdd.length).toBe(5); // alice + bob + charlie + dave + creator

    await removeMember("dave");
    const membersAfterRemove = await group.members();
    expect(membersAfterRemove.length).toBe(4);
  });

  it("should demonstrate simplified DM testing", async () => {
    // Simplified DM setup
    const { dm, sendAndVerifyMessage } = await setupSimplifiedDmTest({
      testName,
      sender: "alice",
      receiver: "bob",
    });

    expect(dm.id).toBeDefined();

    // Send and verify multiple messages easily
    const results = await Promise.all([
      sendAndVerifyMessage("First message"),
      sendAndVerifyMessage("Second message"),
      sendAndVerifyMessage("Third message"),
    ]);

    results.forEach((delivered) => {
      expect(delivered).toBe(true);
    });
  });

  it("should demonstrate batch operations with error handling", async () => {
    const { group, updateGroupDetails } = await setupSimplifiedGroupTest({
      testName,
      workerNames: ["alice", "bob"],
    });

    // Batch operations with simplified error handling
    const operations = [
      async () => {
        await updateGroupDetails("Batch Test Group");
      },
      async () => {
        await group.send("Message 1");
      },
      async () => {
        await group.send("Message 2");
      },
      async () => {
        await updateGroupDetails(undefined, "Updated description");
      },
    ];

    const results = await runBatchOperations(operations, {
      continueOnError: true,
      logErrors: false,
    });

    expect(results.length).toBe(4);
  });

  it("should demonstrate performance measurement", async () => {
    const { sendAndVerifyMessage } = await setupSimplifiedGroupTest({
      testName,
      workerNames: ["alice", "bob"],
    });

    // Measure operation performance easily
    const { result, durationMs } = await measureOperationTime(
      () => sendAndVerifyMessage("Performance test message"),
      "Message send and verify",
    );

    expect(result).toBe(true);
    expect(durationMs).toBeGreaterThan(0);
  });

  it("should compare old vs new approach complexity", async () => {
    // OLD WAY (commented out to show contrast):
    /*
    const workers = await getWorkers(["alice", "bob", "charlie"], { useVersions: false });
    const memberInboxIds = workers.getAllButCreator().map(w => w.client.inboxId);
    const group = await workers.getCreator().client.conversations.newGroup(memberInboxIds) as Group;
    
    workers.getAllButCreator().forEach(worker => {
      worker.worker.startStream(typeofStream.Message);
    });
    
    await group.updateName("Test Group");
    await group.sync();
    expect(group.name).toBe("Test Group");
    
    const message = "test-" + Math.random().toString(36).substring(2, 15);
    await group.send(message);
    
    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      1,
      message
    );
    expect(verifyResult.allReceived).toBe(true);
    */

    // NEW WAY (simplified):
    const { sendAndVerifyMessage, updateGroupDetails } =
      await setupSimplifiedGroupTest({
        testName,
        workerNames: ["alice", "bob", "charlie"],
      });

    await updateGroupDetails("Test Group");

    const messageDelivered = await sendAndVerifyMessage("test-message");
    expect(messageDelivered).toBe(true);

    // 3 lines vs 15+ lines - significant reduction in complexity!
  });
});
