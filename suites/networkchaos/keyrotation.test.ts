import { describe, expect, it } from "vitest";
import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { typeOfResponse, typeofStream } from "@workers/main";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "keyrotation-chaos";
loadEnv(testName);

function scheduleAsyncTask(
  task: () => Promise<void>,
  intervalMs: number
): NodeJS.Timeout {
  return setInterval(() => {
    task().catch(err => {
      console.error(`[scheduled task] error in ${task.name}:`, err);
    });
  }, intervalMs);
}

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

    // 1) Fire off the send loop
    async function sendLoop() {
      while (Date.now() - startTime < chaosDuration) {
        for (const sender of workers.getAll()) {
          const convo = await sender.client.conversations.getConversationById(group.id);
          if (!convo) {
            throw new Error(`[sendLoop] No convo for ${sender.name}`);
          }
          await convo.send(`gm-${sender.name}-${Date.now()}`);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    async function doVerify() {
      console.log("[verify] Checking fork and delivery");
      await workers.checkForks();
      const res = await verifyMessageStream(group, workers.getAllButCreator());
      expect(res.allReceived).toBe(true);
    }

    async function doKeyRotation() {
      console.log("[key-rotation] Rotating group key");
      const newMember = workers.getRandomWorker().client.inboxId;
      await group.removeMembers([newMember]);
      await group.addMembers([newMember]);
      const info = await group.debugInfo();
      console.log("[key-rotation] After rotation, epoch =", info.epoch);
    }

    async function doChaos() {
      console.log("[chaos] Applying network chaos");
      const nodes = allNodes;
      for (const node of nodes) {
        const delay = 300 + Math.floor(Math.random() * 400);   // 300–700ms
        const jitter = 50 + Math.floor(Math.random() * 150);   // 50–200ms
        const loss = 2 + Math.random() * 8;                    // 2–10% PL
        try {
          node.addJitter(delay, jitter);
          if (Math.random() < 0.5) node.addLoss(loss);
        } catch (err) {
            console.warn("[chaos] Error applying netem on " + node.name + ":", err);
        }
        if (node !== nodes[0]) {
          await nodes[0].ping(node);
        }
      }
    }

    // 5) Start the repeating tasks
    const verifyInterval = scheduleAsyncTask(doVerify, 10_000);
    const rotationInterval = scheduleAsyncTask(doKeyRotation, 10_000);
    const chaosInterval = scheduleAsyncTask(doChaos, 10_000);

    try {
      // 6) Run traffic
      await sendLoop();

      // 7) Cooldown
      console.log(`[cooldown] Waiting ${stopChaosBeforeEnd / 1000}s before final validation`);
      clearInterval(verifyInterval);
      clearInterval(rotationInterval);
      clearInterval(chaosInterval);
      await new Promise((r) => setTimeout(r, stopChaosBeforeEnd));
    } catch (err: unknown) {
      console.error("[test] Error during chaos test:", err);
      clearInterval(verifyInterval);
      clearInterval(rotationInterval);
      clearInterval(chaosInterval);
      throw err;
    }

    // 8) Final check
    console.log("[final] Validating final group state and message sync");
    await workers.checkForks();
    const verifyFinal = await verifyMessageStream(group, otherUsers);
    expect(verifyFinal.allReceived).toBe(true);
  });
});
