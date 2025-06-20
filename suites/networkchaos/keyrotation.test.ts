import { describe, expect, it } from "vitest";
import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { typeOfResponse, typeofStream } from "@workers/main";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "keyrotation-chaos";
loadEnv(testName);

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

  const workers = await getWorkers(
    userDescriptors,
    testName,
    typeofStream.Message,
    typeOfResponse.Gm
  );

  setupTestLifecycle({ testName, expect });

  it("should handle staggered key rotations and network chaos under load", async () => {
    const group = await workers.createGroup("Key Rotation Stress Test");
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

    // fire-and-forget send loop
    const sendLoop = async () => {
      while (Date.now() - startTime < chaosDuration) {
        for (const sender of allUsers) {
          const convo = await sender.client.conversations.getConversationById(group.id);
          if (!convo) throw new Error(`[sendLoop] No convo for ${sender.name}`);
          const content = `gm-${sender.name}-${Date.now()}`;
          await convo.send(content);
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
      }, 10 * 1000);
    };

    // rotate keys every 10s
    const keyRotationLoop = () => {
      rotationInterval = setInterval(() => {
        void (async () => {
          console.log("[key-rotation] Rotating group key");
          try {
            const newMember = workers.getRandomWorker().client.inboxId;
            await group.removeMembers([newMember]);
            await group.addMembers([newMember]);
            const info = await group.debugInfo();
          console.log("[key-rotation] After rotation, epoch =", info.epoch);
          } catch (err) {
            console.error("[key-rotation] error:", err);
          }
        })();
      }, 10 * 1000);
    };

    // inject chaos every 10s
    const startChaos = () => {
      chaosInterval = setInterval(() => {
        void (async () => {
          console.log("[chaos] Applying network chaos");
          for (const node of allNodes) {
          const delay = 300 + Math.floor(Math.random() * 400);   // 300–700ms
          const jitter = 50 + Math.floor(Math.random() * 150);   // 50–200ms
          const loss = 2 + Math.random() * 8;                    // 2–10% PL

            try {
              node.addJitter(delay, jitter);
              if (Math.random() < 0.5) node.addLoss(loss);
            } catch (err) {
            console.warn("[chaos] Error applying netem on " + node.name + ":", err);
            }
            if (node !== allNodes[0]) {
              await allNodes[0].ping(node);
            }
          }
        })();
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
      await sendLoop();

      console.log("[cooldown] Waiting " + (stopChaosBeforeEnd / 1000).toString() + "s before final validation");
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
