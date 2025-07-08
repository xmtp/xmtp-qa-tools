import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "stream";
describe(testName, async () => {
  setupTestLifecycle({ testName });

  // Set up multi-node environment with network chaos capabilities
  const allNodes = [
    new DockerContainer("multinode-node1-1"),
    new DockerContainer("multinode-node2-1"),
    new DockerContainer("multinode-node3-1"),
    new DockerContainer("multinode-node4-1"),
  ];

  // Randomly assign users to different nodes for network diversity
  const userDescriptors: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    const user = `user${i + 1}`;
    const port = 5556 + 1000 * Math.floor(Math.random() * 4); // 5556, 6556, 7556, 8556
    userDescriptors[user] = `http://localhost:${port}`;
  }

  const workers = await getWorkers(userDescriptors);

  it("should maintain message stream integrity under network chaos", async () => {
    // Create a group for testing
    const group = await workers.createGroupBetweenAll(
      "Network Chaos Stream Test",
    );
    const receivers = workers.getAllButCreator();

    // Initial verification - verify stream is working at the beginning
    console.log("[test] Starting initial stream verification...");
    const initialResult = await verifyMessageStream(
      group,
      receivers,
      5, // Send 5 messages
      "initial-{i}-{randomSuffix}",
    );
    expect(initialResult.allReceived).toBe(true);
    console.log("[test] Initial verification passed");

    // Start network chaos
    console.log(
      "[chaos] Injecting network chaos (latency, jitter, packet loss)...",
    );
    const chaosDuration = 30 * 1000; // 30 seconds of chaos
    const startTime = Date.now();

    let chaosInterval: NodeJS.Timeout;
    let verifyInterval: NodeJS.Timeout;

    const startChaos = () => {
      chaosInterval = setInterval(() => {
        console.log("[chaos] Applying network chaos to all nodes...");
        for (const node of allNodes) {
          const delay = Math.floor(50 + Math.random() * 200); // 50-250ms
          const jitter = Math.floor(Math.random() * 50); // 0-50ms
          const loss = Math.random() * 3; // 0-3% packet loss

          try {
            node.addJitter(delay, jitter);
            if (Math.random() < 0.3) node.addLoss(loss);
          } catch (err) {
            console.warn(`[chaos] Error applying netem on ${node.name}:`, err);
          }
        }
      }, 5 * 1000); // Apply chaos every 5 seconds
    };

    const verifyUnderChaos = () => {
      verifyInterval = setInterval(() => {
        void (async () => {
          try {
            console.log("[verify] Checking message stream under chaos...");
            await workers.checkForks();
            const res = await verifyMessageStream(
              group,
              receivers,
              3, // Send 3 messages per check
              "chaos-{i}-{randomSuffix}",
            );
            expect(res.allReceived).toBe(true);
            console.log("[verify] Stream verification under chaos passed");
          } catch (e) {
            console.warn("[verify] Stream check failed under chaos:", e);
          }
        })();
      }, 10 * 1000); // Check every 10 seconds
    };

    const clearChaos = () => {
      clearInterval(chaosInterval);
      clearInterval(verifyInterval);
      console.log("[chaos] Clearing network chaos...");
      for (const node of allNodes) {
        try {
          node.clearLatency();
        } catch (err) {
          console.warn(`[chaos] Error clearing chaos on ${node.name}:`, err);
        }
      }
    };

    try {
      // Start chaos and verification loops
      verifyUnderChaos();
      startChaos();

      // Let chaos run for the specified duration
      console.log(
        `[test] Running chaos for ${chaosDuration / 1000} seconds...`,
      );
      await new Promise((resolve) => setTimeout(resolve, chaosDuration));

      // Stop chaos and wait for network to stabilize
      clearChaos();
      console.log("[test] Waiting for network to stabilize...");
      await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
    } catch (err) {
      console.error("[test] Error during chaos test:", err);
      clearChaos();
      throw err;
    }

    // Final verification after chaos
    console.log("[test] Performing final stream verification...");
    await workers.checkForks();
    const finalResult = await verifyMessageStream(
      group,
      receivers,
      5, // Send 5 final messages
      "final-{i}-{randomSuffix}",
    );
    expect(finalResult.allReceived).toBe(true);
    console.log(
      "[test] Final verification passed - stream integrity maintained",
    );

    console.log(
      "[test] All stream verifications completed successfully under network chaos",
    );
  });
});
