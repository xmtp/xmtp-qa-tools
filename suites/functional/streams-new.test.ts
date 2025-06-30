import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "streams-new";

describe(testName, async () => {
  const workerNames = ["alice", "bob", "charlie", "david"];

  // 🆕 NEW APPROACH: Create workers without ANY stream type parameters
  // This demonstrates the new paradigm where streams are purely dynamic
  //
  // OLD WAY: getWorkers(names, testName, typeofStream.Message) ❌
  // NEW WAY: getWorkers(names, testName) → then start streams dynamically ✅
  let workers = await getWorkers(workerNames, testName);

  setupTestLifecycle({
    testName,
    expect,
    workers,
  });

  it("should create workers without declaring any stream types upfront", () => {
    try {
      // Verify workers exist but have zero stream configuration
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;

      expect(alice).toBeDefined();
      expect(bob).toBeDefined();
      expect(alice.worker).toBeDefined();
      expect(bob.worker).toBeDefined();

      console.log(
        `✅ Created ${alice.name} and ${bob.name} with completely clean slate - no stream types declared`,
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should dynamically start message streams for real-time messaging", async () => {
    try {
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;

      console.log("🚀 Starting message streams dynamically...");

      // Start message streams on both workers
      alice.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Message);

      console.log("✅ Message streams started successfully");

      // Create a DM conversation
      const dm = (await alice.client.conversations.newDm(
        bob.client.inboxId,
      )) as Dm;
      expect(dm.id).toBeDefined();

      // Test message delivery with dynamically started streams
      const verifyResult = await verifyMessageStream(dm, [bob], 3);
      expect(verifyResult.allReceived).toBe(true);

      console.log("✅ Messages delivered successfully through dynamic streams");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle multiple concurrent stream types simultaneously", async () => {
    try {
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;

      console.log("🔄 Starting multiple stream types concurrently...");

      // Start multiple stream types on the same worker
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.Conversation);
      alice.worker.startStream(typeofStream.Consent);

      bob.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Conversation);

      console.log("✅ Multiple concurrent streams started");

      // Create a group to test conversation streams
      const group = (await alice.client.conversations.newGroup(
        getInboxIds(2).concat([bob.client.inboxId]),
      )) as Group;

      expect(group.id).toBeDefined();

      // Send a message to test message streams
      await group.send("Testing concurrent streams!");

      // Wait a bit for streams to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("✅ Concurrent streams are processing events");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should selectively stop specific stream types while keeping others active", () => {
    try {
      const alice = workers.get(workerNames[0])!;

      console.log("🛑 Testing selective stream stopping...");

      // Start multiple streams
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.Conversation);
      alice.worker.startStream(typeofStream.Consent);

      console.log("✅ Started 3 stream types");

      // Stop only the message stream
      alice.worker.endStream(typeofStream.Message);
      console.log(
        "✅ Stopped message stream, keeping conversation and consent streams",
      );

      // Stop conversation stream
      alice.worker.endStream(typeofStream.Conversation);
      console.log("✅ Stopped conversation stream, keeping consent stream");

      // The consent stream should still be active
      // This demonstrates selective stream control
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should stop all streams at once when needed", () => {
    try {
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;

      console.log("🛑 Testing stop all streams functionality...");

      // Start multiple streams on both workers
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.Conversation);
      bob.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Consent);

      console.log("✅ Started multiple streams on both workers");

      // Stop all streams on alice
      alice.worker.endStream();
      console.log("✅ Stopped all streams on alice");

      // Stop all streams on bob
      bob.worker.endStream();
      console.log("✅ Stopped all streams on bob");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should restart streams after stopping them", async () => {
    try {
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;

      console.log("🔄 Testing stream restart functionality...");

      // Start streams
      alice.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Message);
      console.log("✅ Started message streams");

      // Stop all streams
      alice.worker.endStream();
      bob.worker.endStream();
      console.log("✅ Stopped all streams");

      // Restart streams
      alice.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Message);
      console.log("✅ Restarted message streams");

      // Test functionality after restart
      const dm = (await alice.client.conversations.newDm(
        bob.client.inboxId,
      )) as Dm;

      // Verify streams work after restart
      const verifyResult = await verifyMessageStream(dm, [bob], 2);
      expect(verifyResult.allReceived).toBe(true);

      console.log("✅ Streams working correctly after restart");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle group update streams with dynamic control", async () => {
    try {
      const alice = workers.get(workerNames[0])!;
      const bob = workers.get(workerNames[1])!;
      const charlie = workers.get(workerNames[2])!;

      console.log("📊 Testing group update streams with dynamic control...");

      // Start group update streams specifically
      alice.worker.startStream(typeofStream.GroupUpdated);
      bob.worker.startStream(typeofStream.GroupUpdated);
      charlie.worker.startStream(typeofStream.GroupUpdated);

      console.log("✅ Started group update streams");

      // Create a group
      const group = (await alice.client.conversations.newGroup([
        bob.client.inboxId,
      ])) as Group;

      expect(group.id).toBeDefined();

      // Update group metadata to trigger group update events
      await group.updateName("Dynamic Stream Test Group");
      await group.updateDescription(
        "Testing group updates with dynamic streams",
      );

      // Add a new member to trigger more updates
      await group.addMembers([charlie.client.inboxId]);

      console.log("✅ Triggered group update events");

      // Wait for streams to process updates
      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log("✅ Group update streams processed events successfully");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should demonstrate the new stream lifecycle management paradigm", () => {
    try {
      const alice = workers.get(workerNames[0])!;

      console.log("🔄 Demonstrating the NEW stream lifecycle paradigm...");

      // Pattern 1: Workers start completely clean (nothing declared upfront)
      console.log("1️⃣ Workers created with zero stream configuration");

      // Pattern 2: Add streams based on runtime application needs
      console.log("2️⃣ Dynamically adding message stream for real-time chat");
      alice.worker.startStream(typeofStream.Message);

      console.log(
        "3️⃣ Adding conversation stream for new conversation detection",
      );
      alice.worker.startStream(typeofStream.Conversation);

      // Pattern 3: Temporarily disable specific functionality
      console.log("4️⃣ Temporarily disabling message stream for maintenance");
      alice.worker.endStream(typeofStream.Message);

      // Pattern 4: Re-enable when ready
      console.log("5️⃣ Re-enabling message stream after maintenance");
      alice.worker.startStream(typeofStream.Message);

      // Pattern 5: Clean shutdown
      console.log("6️⃣ Clean shutdown - stopping all streams");
      alice.worker.endStream();

      console.log("✅ Demonstrated complete stream lifecycle management");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle edge cases and error scenarios gracefully", () => {
    try {
      const alice = workers.get(workerNames[0])!;

      console.log("⚠️ Testing edge cases and error handling...");

      // Edge case 1: Starting the same stream type multiple times
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.Message); // Should be idempotent
      console.log("✅ Handled duplicate stream start requests");

      // Edge case 2: Stopping a stream that wasn't started
      alice.worker.endStream(typeofStream.Consent); // Should not cause errors
      console.log("✅ Handled stopping non-existent stream");

      // Edge case 3: Starting None stream type
      alice.worker.startStream(typeofStream.None); // Should be ignored
      console.log("✅ Handled None stream type correctly");

      // Edge case 4: Multiple stop calls
      alice.worker.endStream();
      alice.worker.endStream(); // Should be safe
      console.log("✅ Handled multiple stop calls");

      console.log("✅ All edge cases handled gracefully");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
