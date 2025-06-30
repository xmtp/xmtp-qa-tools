import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { DockerContainer } from "../../network-stability-utilities/container";
import { describe, expect, it } from "vitest";

// Chaos knobs
const CHAOS_LATENCY_MS = process.env.CHAOS_LATENCY_MS ? parseInt(process.env.CHAOS_LATENCY_MS) : 0;
const CHAOS_JITTER_MS = process.env.CHAOS_JITTER_MS ? parseInt(process.env.CHAOS_JITTER_MS) : 0;
const CHAOS_PACKET_LOSS_PCT = process.env.CHAOS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_PACKET_LOSS_PCT) : 0;

const CHAOS_EGRESS_LATENCY_MS = process.env.CHAOS_EGRESS_LATENCY_MS ? parseInt(process.env.CHAOS_EGRESS_LATENCY_MS) : 0;
const CHAOS_EGRESS_JITTER_MS = process.env.CHAOS_EGRESS_JITTER_MS ? parseInt(process.env.CHAOS_EGRESS_JITTER_MS) : 0;
const CHAOS_EGRESS_PACKET_LOSS_PCT = process.env.CHAOS_EGRESS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_EGRESS_PACKET_LOSS_PCT) : 0;

// Other test knobs
const groupCount = process.env.GROUP_COUNT ? parseInt(process.env.GROUP_COUNT) : 5;
const parallelOperations = process.env.PARALLEL_OPS ? parseInt(process.env.PARALLEL_OPS) : 1;
const TARGET_EPOCH = process.env.TARGET_EPOCH ? parseInt(process.env.TARGET_EPOCH) : 100;
const randomInboxIdsCount = process.env.RANDOM_INBOX_IDS ? parseInt(process.env.RANDOM_INBOX_IDS) : 30;
const installationCount = process.env.INSTALLATION_COUNT ? parseInt(process.env.INSTALLATION_COUNT) : 5;
const workerCount = process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT) : 10;
const workerPrefix = "random";

const workerNames = Array.from({ length: workerCount }, (_, i) => `${workerPrefix}${i + 1}`);

const typeofStreamForTest = typeofStream.Message;
const typeOfResponseForTest = typeOfResponse.Gm;
const typeOfSyncForTest = typeOfSync.Both;

describe("commits", () => {
  setupTestLifecycle({
    testName: "commits",
    expect,
  });

  const createOperations = async (worker: Worker, group: Group) => {
    await worker.client.conversations.syncAll();

    const getGroup = () =>
      worker.client.conversations.getConversationById(group.id) as Promise<Group>;

    return {
      updateName: () =>
        getGroup().then((g) =>
          g.updateName(`${getTime()} - ${worker.name} Update`)
        ),
      createInstallation: () =>
        getGroup().then(() => worker.worker.addNewInstallation()),
      addMember: () =>
        getGroup().then((g) => {
          const randomInboxIds = getRandomInboxIds(randomInboxIdsCount, installationCount);
          return g.addMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]);
        }),
      removeMember: () =>
        getGroup().then((g) => {
          const randomInboxIds = getRandomInboxIds(randomInboxIdsCount, installationCount);
          return g.removeMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]);
        }),
      sendMessage: () =>
        getGroup().then((g) =>
          g.send(`Message from ${worker.name}`).then(() => { })
        ),
    };
  };

  const applyChaosIfEnabled = (): (() => void) => {
    const ingressEnabled = CHAOS_LATENCY_MS || CHAOS_JITTER_MS || CHAOS_PACKET_LOSS_PCT;
    const egressEnabled = CHAOS_EGRESS_LATENCY_MS || CHAOS_EGRESS_JITTER_MS || CHAOS_EGRESS_PACKET_LOSS_PCT;

    if (!ingressEnabled && !egressEnabled) {
      console.log("[chaos] Skipping chaos injection - all knobs set to 0");
      return () => {};
    }

    const nodes = DockerContainer.getNodes();
    if (nodes.length === 0) {
      console.warn("[chaos] No XMTP nodes detected - check environment!");
      return () => {};
    }

    console.log("[chaos] Detected " + nodes.length + " XMTP node(s): " + nodes.map(n => n.name).join(", "));

    if (ingressEnabled) {
      console.log("[chaos] Applying ingress (host to container) chaos");
      for (const node of nodes) {
        if (CHAOS_JITTER_MS > 0) {
          node.addJitter(CHAOS_LATENCY_MS, CHAOS_JITTER_MS);
        } else if (CHAOS_LATENCY_MS > 0) {
          node.addLatency(CHAOS_LATENCY_MS);
        }

        if (CHAOS_PACKET_LOSS_PCT > 0) {
          node.addLoss(CHAOS_PACKET_LOSS_PCT);
        }
      }
    }

    if (egressEnabled && nodes.length > 1) {
      console.log("[chaos] Applying egress (container to others) chaos");
      for (const node of nodes) {
        if (CHAOS_EGRESS_JITTER_MS > 0) {
          node.addEgressJitter(CHAOS_EGRESS_LATENCY_MS, CHAOS_EGRESS_JITTER_MS);
        } else if (CHAOS_EGRESS_LATENCY_MS > 0) {
          node.addEgressLatency(CHAOS_EGRESS_LATENCY_MS);
        }

        if (CHAOS_EGRESS_PACKET_LOSS_PCT > 0) {
          node.addEgressLoss(CHAOS_EGRESS_PACKET_LOSS_PCT);
        }
      }
    }

    console.log("[chaos] Checking connectivity between XMTP nodes via ping...");
    if (nodes.length > 1) {
      for (let i = 0; i < nodes.length; i++) {
        console.log("[chaos] Host to " + nodes[i].name + " ping");
        nodes[i].pingFromHost();
        for (let j = i + 1; j < nodes.length; j++) {
          console.log("[chaos] " + nodes[i].name + " to " + nodes[j].name);
          nodes[i].ping(nodes[j]);
        }
      }
    } else {
      console.log("[chaos] Host to single node");
      nodes[0].pingFromHost();
    }

    return () => {
      console.log("[chaos] Clearing netem on all XMTP nodes");
      for (const node of nodes) {
        node.clearLatency();
        node.clearEgressLatency();
      }
    };
  };

  it("should perform concurrent operations with multiple users across groups", async () => {
    const nodes = DockerContainer.getNodes();

    let workers: Awaited<ReturnType<typeof getWorkers>>;
    if (nodes.length > 1) {
      const basePort = 5556;
      const ports = nodes.map((_, i) => basePort + i * 1000);
      const userDescriptors: Record<string, string> = {};
      for (let i = 0; i < workerCount; i++) {
        const port = ports[i % ports.length];
        userDescriptors[`${workerPrefix}${i + 1}`] = `http://localhost:${port}`;
      }

      console.log("Running commits.test.ts with the following configuration:");
      console.table({
        GROUP_COUNT: groupCount,
        PARALLEL_OPS: parallelOperations,
        TARGET_EPOCH: TARGET_EPOCH,
        RANDOM_INBOX_IDS: randomInboxIdsCount,
        INSTALLATION_COUNT: installationCount,
        WORKER_COUNT: workerCount,
        CHAOS_LATENCY_MS,
        CHAOS_JITTER_MS,
        CHAOS_PACKET_LOSS_PCT,
        CHAOS_EGRESS_LATENCY_MS,
        CHAOS_EGRESS_JITTER_MS,
        CHAOS_EGRESS_PACKET_LOSS_PCT,
      });

      console.log("[partition] Assigning users to XMTP nodes by port:");
      console.table(userDescriptors);

      workers = await getWorkers(
        userDescriptors,
        "commits",
        typeofStreamForTest,
        typeOfResponseForTest,
        typeOfSyncForTest,
        "local"
      );
    } else {
      workers = await getWorkers(
        workerNames,
        "commits",
        typeofStreamForTest,
        typeOfResponseForTest,
        typeOfSyncForTest,
        "local"
      );
    }

    const clearChaos = applyChaosIfEnabled();

    try {
      const creator = workers.getCreator();
      const groupOperationPromises = Array.from(
        { length: groupCount },
        async (_, groupIndex) => {
          const group = (await creator.client.conversations.newGroup([])) as Group;

          for (const worker of workers.getAllButCreator()) {
            await group.addMembers([worker.client.inboxId]);
            await group.addSuperAdmin(worker.client.inboxId);
          }

          let currentEpoch = 0n;
          while (currentEpoch < TARGET_EPOCH) {
            const parallelOps = Array.from({ length: parallelOperations }, async () => {
              const randomWorker =
                workers.getAll()[Math.floor(Math.random() * workers.getAll().length)];

              const ops = await createOperations(randomWorker, group);
              const operations = [
                ops.updateName,
                ops.sendMessage,
                ops.addMember,
                ops.removeMember,
                ops.createInstallation,
              ];

              const op = operations[Math.floor(Math.random() * operations.length)];
              try {
                await op();
              } catch (e) {
                console.log("Group " + (groupIndex + 1) + " operation failed:", e);
              }
            });

            await Promise.all(parallelOps);
            await workers.checkForksForGroup(group.id);
            currentEpoch = (await group.debugInfo()).epoch;
          }

          return { groupIndex, finalEpoch: currentEpoch };
        }
      );

      await Promise.all(groupOperationPromises);
    } finally {
      clearChaos();
    }
  });
});