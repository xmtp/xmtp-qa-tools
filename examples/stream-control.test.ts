import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { typeofStream } from "@workers/main";
import { describe, expect, it } from "vitest";

const testName = "stream-control-example";

describe(testName, async () => {
  // Create workers without any initial streams
  const workers = await getWorkers(["alice", "bob"], testName, typeofStream.None);

  setupTestLifecycle({
    expect,
    workers,
    testName,
  });

  it("should demonstrate dynamic stream control", async () => {
    try {
      const alice = workers.get("alice")!;
      const bob = workers.get("bob")!;

      console.log("🚀 Starting dynamic stream control demo...");

      // 1. Start message streams dynamically
      console.log("📨 Starting message streams for both workers");
      alice.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Message);

      // Create a group and send a message
      const group = await alice.client.conversations.newGroup([bob.client.inboxId], {
        groupName: "Stream Control Test Group",
      });

      await group.send("Hello from Alice!");

      // Collect the message on Bob's side
      const messages = await bob.worker.collectMessages(group.id, 1);
      expect(messages).toHaveLength(1);
      expect(messages[0].message.content).toBe("Hello from Alice!");
      console.log("✅ Message delivery verified");

      // 2. Stop message streams and start group update streams
      console.log("🔄 Switching from message streams to group update streams");
      alice.worker.endStream(typeofStream.Message);
      bob.worker.endStream(typeofStream.Message);

      alice.worker.startStream(typeofStream.GroupUpdated);
      bob.worker.startStream(typeofStream.GroupUpdated);

      // Update group metadata
      await group.updateName("Updated Group Name");

      // Collect the group update
      const groupUpdates = await bob.worker.collectGroupUpdates(group.id, 1);
      expect(groupUpdates).toHaveLength(1);
      expect(groupUpdates[0].group.name).toBe("Updated Group Name");
      console.log("✅ Group update verified");

      // 3. Run multiple stream types simultaneously
      console.log("🔀 Running multiple stream types simultaneously");
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.Conversation);
      bob.worker.startStream(typeofStream.Message);
      bob.worker.startStream(typeofStream.Conversation);

      // Send another message while conversation stream is active
      await group.send("Multiple streams active!");

      const finalMessages = await bob.worker.collectMessages(group.id, 1);
      expect(finalMessages).toHaveLength(1);
      expect(finalMessages[0].message.content).toBe("Multiple streams active!");
      console.log("✅ Multiple stream types working simultaneously");

      // 4. Stop all streams
      console.log("🛑 Stopping all streams");
      alice.worker.endStream();
      bob.worker.endStream();

      console.log("🎉 Stream control demo completed successfully!");

    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle selective stream stopping", async () => {
    try {
      const alice = workers.get("alice")!;
      const bob = workers.get("bob")!;

      console.log("🎯 Testing selective stream stopping...");

      // Start multiple streams
      alice.worker.startStream(typeofStream.Message);
      alice.worker.startStream(typeofStream.GroupUpdated);
      alice.worker.startStream(typeofStream.Conversation);

      // Stop only the message stream
      alice.worker.endStream(typeofStream.Message);

      // Verify other streams are still active by starting group updates on Bob
      bob.worker.startStream(typeofStream.GroupUpdated);

      const group = await alice.client.conversations.newGroup([bob.client.inboxId]);
      await group.updateName("Selective Stop Test");

      const updates = await bob.worker.collectGroupUpdates(group.id, 1);
      expect(updates).toHaveLength(1);
      console.log("✅ Selective stream stopping works correctly");

      // Cleanup
      alice.worker.endStream();
      bob.worker.endStream();

    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});