import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "networkchaos";
loadEnv(testName);

describe(testName, async () => {
  const allNodes = [
    new DockerContainer("multinode-node1-1"),
    new DockerContainer("multinode-node2-1"),
    new DockerContainer("multinode-node3-1"),
    new DockerContainer("multinode-node4-1"),
  ];

  // Randomly assign 20 users to the 4 nodes via API URLs
  const userDescriptors: Record<string, string> = {};
  for (let i = 0; i < 20; i++) {
    const user = `user${i + 1}`;
    const port = 5556 + 1000 * Math.floor(Math.random() * 4); // 5556, 6556, 7556, 8556
    userDescriptors[user] = `http://localhost:${port}`;
  }

  const workers = await getWorkers(
    userDescriptors,
    typeofStream.Message,
    typeOfResponse.Gm,
  );

  setupTestLifecycle({ testName, expect });

  it("should survive sustained latency + jitter + packet loss under group message load", async () => {
    const group = await workers.createGroupBetweenAll(
      "Latency Chaos Spike Test",
    );
    await group.sync();

    const chaosDuration = 60 * 1000;
    const stopChaosBeforeEnd = 5 * 1000;
    const startTime = Date.now();

    let chaosInterval: NodeJS.Timeout;
    let verifyInterval: NodeJS.Timeout;

    const allUsers = workers.getAll();
    const otherUsers = workers.getAllButCreator();

    // Kick off traffic stream
    console.log("[start] Initiating concurrent traffic flood");
    const sendLoop = async () => {
      while (Date.now() - startTime < chaosDuration) {
        for (const sender of allUsers) {
          const convo = await sender.client.conversations.getConversationById(
            group.id,
          );
          const content = `gm-${sender.name}-${Date.now()}`;
          await convo!.send(content);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };

    const verifyLoop = () => {
      verifyInterval = setInterval(() => {
        void (async () => {
          try {
            console.log("[verify] Checking fork and delivery under chaos");
            await workers.checkForks();
            const res = await verifyMessageStream(group, otherUsers);
            expect(res.allReceived).toBe(true);
          } catch (e) {
            console.warn("[verify] Skipping check due to exception:", e);
          }
        })();
      }, 10 * 1000);
    };

    const startChaos = () => {
      chaosInterval = setInterval(() => {
        console.log(
          "[chaos] Applying jitter, delay, and drop rules to all nodes...",
        );
        for (const node of allNodes) {
          const delay = Math.floor(100 + Math.random() * 400); // 100�500ms
          const jitter = Math.floor(Math.random() * 100); // 0�100ms
          const loss = Math.random() * 5; // 0�5% packet loss

          try {
            node.addJitter(delay, jitter);
            if (Math.random() < 0.5) node.addLoss(loss);
          } catch (err) {
            console.warn(`[chaos] Error applying netem on ${node.name}:`, err);
          }
          if (node != allNodes[0]) {
            allNodes[0].ping(node);
          }
        }
      }, 10 * 1000);
    };

    const clearChaos = () => {
      clearInterval(chaosInterval);
      clearInterval(verifyInterval);
      for (const node of allNodes) {
        node.clearLatency();
      }
    };

    try {
      verifyLoop();
      startChaos();
      await sendLoop();
      console.log(
        `[cooldown] Waiting ${stopChaosBeforeEnd / 1000}s before final validation`,
      );
      clearChaos();
      await new Promise((r) => setTimeout(r, stopChaosBeforeEnd));
    } catch (err) {
      console.error("[test] Encountered error during chaos:", err);
      clearChaos();
      throw err;
    }

    // Final delivery validation
    console.log("[final] Validating full group state and message sync");
    await workers.checkForks();
    const verifyFinal = await verifyMessageStream(group, otherUsers);
    expect(verifyFinal.allReceived).toBe(true);
  });
});
