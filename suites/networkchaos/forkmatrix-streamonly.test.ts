import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const chaosLatencyMs = process.env.CHAOS_LATENCY_MS ? parseInt(process.env.CHAOS_LATENCY_MS) : 0;
const chaosJitterMs = process.env.CHAOS_JITTER_MS ? parseInt(process.env.CHAOS_JITTER_MS) : 0;
const chaosLossPct = process.env.CHAOS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_PACKET_LOSS_PCT) : 0;

const chaosEgressLatencyMs = process.env.CHAOS_EGRESS_LATENCY_MS ? parseInt(process.env.CHAOS_EGRESS_LATENCY_MS) : 0;
const chaosEgressJitterMs = process.env.CHAOS_EGRESS_JITTER_MS ? parseInt(process.env.CHAOS_EGRESS_JITTER_MS) : 0;
const chaosEgressLossPct = process.env.CHAOS_EGRESS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_EGRESS_PACKET_LOSS_PCT) : 0;

const workerCount = process.env.GROUP_SIZE ? parseInt(process.env.GROUP_SIZE) : 20;
const opFreq = process.env.OP_FREQ ? parseInt(process.env.OP_FREQ) : 10000;

const durationMs = 300000;

const enabledOps = process.env.ENABLED_OPS
  ? process.env.ENABLED_OPS.split(",").map((s) => s.trim())
  : [
    "verify",
    "updateName",
    "modifyMembership",
    "promoteAdmin",
    "demoteAdmin"
  ];

console.log("=== Fork Matrix Test Configuration ===");
console.table({
  DURATION_MS: durationMs,
  CHAOS_LATENCY_MS: chaosLatencyMs,
  CHAOS_JITTER_MS: chaosJitterMs,
  CHAOS_PACKET_LOSS_PCT: chaosLossPct,
  CHAOS_EGRESS_LATENCY_MS: chaosEgressLatencyMs,
  CHAOS_EGRESS_JITTER_MS: chaosEgressJitterMs,
  CHAOS_EGRESS_PACKET_LOSS_PCT: chaosEgressLossPct,
  ENABLED_OPS: enabledOps.join(", "),
  GROUP_SIZE: workerCount,
  OP_FREQ: opFreq
});
console.log("=======================================");

const testName = "forkmatrix-chaos";
describe(testName, async () => {
  setupTestLifecycle({ testName });

  const allNodes = [
    new DockerContainer("multinode-node1-1"),
    new DockerContainer("multinode-node2-1"),
    new DockerContainer("multinode-node3-1"),
    new DockerContainer("multinode-node4-1")
  ];

  const userDescriptors = {};
  for (let i = 0; i < workerCount; i++) {
    const user = "user" + (i + 1);
    const port = 5556 + 1000 * Math.floor(Math.random() * 4);
    userDescriptors[user] = "http://localhost:" + port;
  }

  const workers = await getWorkers(userDescriptors);
  workers.startStream(typeofStream.MessageandResponse);

  it("should run matrixed fork heatmap chaos test", async () => {
    const group = await workers.createGroupBetweenAll("Fork Matrix Group");
    await group.sync();

    const startTime = Date.now();
    let chaosInterval;
    let verifyInterval;
    let opInterval;

    const verifyLoop = async () => {
      if (!enabledOps.includes("verify")) return;
      verifyInterval = setInterval(() => {
        void (async () => {
          try {
            console.log("[verify] Checking forks and delivery");
            await workers.checkForks();
            const res = await verifyMessageStream(group, workers.getAllButCreator());
            expect(res.allReceived).toBe(true);
          } catch (err) {
            console.warn("[verify] Skipping check due to error", err);
          }
        })();
      }, 1000);
    };

    const operationLoop = () => {
      let opCounter = 0;

      opInterval = setInterval(() => {
        void (async () => {
          opCounter++;

          const groupId = group.id;
          const target = workers.getRandomWorker();
          const convo = await target.client.conversations.getConversationById(groupId);
          if (!convo) return;

          const inboxId = target.client.inboxId;

          if (enabledOps.includes("updateName")) {
            console.log(`[op #${opCounter}] executing updateName - setting new name for group`);
            await group.updateName("Update Group Name Test " + Date.now());
          }

          if (enabledOps.includes("modifyMembership")) {
            console.log(`[op #${opCounter}] executing modifyMembership - removing and re-adding user ${inboxId}`);
            await group.removeMembers([inboxId]);
            await group.addMembers([inboxId]);
          }

          if (enabledOps.includes("promoteAdmin")) {
            console.log(`[op #${opCounter}] executing promoteAdmin - promoting user ${inboxId}`);
            await group.addSuperAdmin(inboxId);
          }

          if (enabledOps.includes("demoteAdmin")) {
            console.log(`[op #${opCounter}] executing demoteAdmin - demoting user ${inboxId}`);
            await group.removeSuperAdmin(inboxId);
          }
        })();
      }, opFreq);
    };


    const startChaos = () => {
      const ingressEnabled = chaosLatencyMs || chaosJitterMs || chaosLossPct;
      const egressEnabled = chaosEgressLatencyMs || chaosEgressJitterMs || chaosEgressLossPct;

      if (!ingressEnabled && !egressEnabled) {
        console.log("[chaos] Skipping chaos injection - all knobs set to 0");
        return;
      }

      chaosInterval = setInterval(() => {
        console.log("[chaos] Updating network chaos settings...");
        for (const node of allNodes) {
          try {
            if (chaosJitterMs > 0) {
              node.addJitter(chaosLatencyMs, chaosJitterMs);
            } else if (chaosLatencyMs > 0) {
              node.addLatency(chaosLatencyMs);
            }
            if (chaosLossPct > 0) {
              node.addLoss(chaosLossPct);
            }

            if (chaosEgressJitterMs > 0) {
              node.addEgressJitter(chaosEgressLatencyMs, chaosEgressJitterMs);
            } else if (chaosEgressLatencyMs > 0) {
              node.addEgressLatency(chaosEgressLatencyMs);
            }
            if (chaosEgressLossPct > 0) {
              node.addEgressLoss(chaosEgressLossPct);
            }

            allNodes[0].ping(node);
          } catch (err) {
            console.warn("[chaos] Error applying to " + node.name, err);
          }
        }
      }, 10000);
    };

    const clearAll = () => {
      if (chaosInterval) clearInterval(chaosInterval);
      if (verifyInterval) clearInterval(verifyInterval);
      if (opInterval) clearInterval(opInterval);

      for (const node of allNodes) {
        node.clearLatency();
        node.clearEgressLatency();
      }
    };

    try {
      await verifyLoop();
      startChaos();
      operationLoop();

      await new Promise((r) => setTimeout(r, durationMs));

      console.log("[cooldown] Ending chaos, waiting 10s...");
      clearAll();
      await new Promise((r) => setTimeout(r, 10000));
    } catch (err) {
      console.error("[test] Chaos test error", err);
      clearAll();
      throw err;
    }

    console.log("[final] Validating group state");
    await workers.checkForks();
    const result = await verifyMessageStream(group, workers.getAllButCreator());
    expect(result.allReceived).toBe(true);
  });
});
