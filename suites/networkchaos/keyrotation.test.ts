import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "keyrotation-chaos";

describe(testName, async () => {
  const allNodes = [
    new DockerContainer("multinode-node1-1"),
    new DockerContainer("multinode-node2-1"),
    new DockerContainer("multinode-node3-1"),
    new DockerContainer("multinode-node4-1"),
  ];

  const userDescriptors: Record<string, string> = {};
  for (let i = 0; i < 20; i++) {
    const user = "user" + (i + 1).toString();
    const port = 5556 + 1000 * Math.floor(Math.random() * 4); // 5556, 6556, 7556, 8556
    userDescriptors[user] = "http://localhost:" + port.toString();
  }

  const workers = await getWorkers(userDescriptors);
  // Start message and response streams for the stress testing
  workers.getAll().forEach((worker) => {
    worker.worker.startStream(typeofStream.MessageandResponse);
  });

  setupTestLifecycle({ testName, expect });

  it("should handle staggered key rotations and network chaos under load", async () => {
    const group = await workers.createGroupBetweenAll(
      "Key Rotation Stress Test",
    );
    await group.sync();

    const chaosDuration = 60 * 1000;
    const stopChaosBeforeEnd = 10 * 1000; // Allow 10s of normal network before asserting final state
    const startTime = Date.now();

    let chaosInterval: NodeJS.Timeout;
    let verifyInterval: NodeJS.Timeout;
    let rotationInterval: NodeJS.Timeout;

    const allUsers = workers.getAll();
    const otherUsers = workers.getAllButCreator();

    console.log("[start] Initiating concurrent message traffic");

    const sendLoop = async () => {
      while (Date.now() - startTime < chaosDuration) {
        for (const sender of allUsers) {
          const convo = await sender.client.conversations.getConversationById(
            group.id,
          );
          if (!convo) {
            console.warn(
              `[sendLoop] ${sender.name} not in group right now skipping send`,
            );
            continue;
          }

          const content = `gm-${sender.name}-${Date.now()}`;
          try {
            await convo.send(content);
          } catch (err) {
            console.warn(`[sendLoop] send failed for ${sender.name}:`, err);
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };

    const verifyLoop = () => {
      verifyInterval = setInterval(() => {
        void (async () => {
          try {
            console.log("[verify] Checking fork and delivery");
            await workers.checkForks();
            const res = await verifyMessageStream(group, otherUsers);
            expect(res.allReceived).toBe(true);
          } catch (e) {
            console.warn("[verify] Skipping check due to error:", e);
          }
        })();
      }, 30 * 1000);
    };

    const keyRotationLoop = () => {
      rotationInterval = setInterval(() => {
        console.log(
          "[key-rotation] Rotating group key by adding and removing a random worker from the group...",
        );
        void (async () => {
          try {
            const newMember = workers.getRandomWorker().client.inboxId;
            await group.removeMembers([newMember]);
            await group.addMembers([newMember]);
            const info = await group.debugInfo();
            console.log("[key-rotation] After rotation, epoch =", info.epoch);
          } catch (err) {
            console.error("[key-rotation] error", err);
          }
        })();
      }, 10 * 1000);
    };

    const startChaos = () => {
      chaosInterval = setInterval(() => {
        console.log("[chaos] Injecting latency/jitter/loss...");
        for (const node of allNodes) {
          const delay = 300 + Math.floor(Math.random() * 400);
          const jitter = 50 + Math.floor(Math.random() * 150);
          const loss = 2 + Math.random() * 8;

          try {
            node.addJitter(delay, jitter);
            if (Math.random() < 0.5) node.addLoss(loss);
          } catch (err) {
            console.warn(
              "[chaos] Error applying netem on " + node.name + ":",
              err,
            );
          }

          if (node !== allNodes[0]) {
            allNodes[0].ping(node);
          }
        }
      }, 10 * 1000);
    };

    const clearChaos = () => {
      clearInterval(chaosInterval);
      clearInterval(verifyInterval);
      clearInterval(rotationInterval);
      for (const node of allNodes) {
        node.clearLatency();
      }
    };

    try {
      verifyLoop();
      startChaos();
      keyRotationLoop();
      await sendLoop();

      console.log(
        `[cooldown] Waiting ${stopChaosBeforeEnd / 1000}s before final validation`,
      );
      clearChaos();
      await new Promise((r) => setTimeout(r, stopChaosBeforeEnd));
    } catch (err) {
      console.error("[test] Error during chaos test:", err);
      clearChaos();
      throw err;
    }

    console.log("[final] Validating final group state and message sync");
    await workers.checkForks();
    const verifyFinal = await verifyMessageStream(group, otherUsers);
    expect(verifyFinal.allReceived).toBe(true);
  });
});
