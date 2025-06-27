import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { DockerContainer, getXmtpNodes } from "../../network-stability-utilities/container";
import { describe, expect, it } from "vitest";

// Chaos knobs
const CHAOS_LATENCY_MS = process.env.CHAOS_LATENCY_MS ? parseInt(process.env.CHAOS_LATENCY_MS) : 0;
const CHAOS_JITTER_MS = process.env.CHAOS_JITTER_MS ? parseInt(process.env.CHAOS_JITTER_MS) : 0;
const CHAOS_PACKET_LOSS_PCT = process.env.CHAOS_PACKET_LOSS_PCT ? parseFloat(process.env.CHAOS_PACKET_LOSS_PCT) : 0;

// Other test knobs
const groupCount = process.env.GROUP_COUNT ? parseInt(process.env.GROUP_COUNT) : 5;
const parallelOperations = process.env.PARALLEL_OPS ? parseInt(process.env.PARALLEL_OPS) : 1;
const TARGET_EPOCH = process.env.TARGET_EPOCH ? BigInt(process.env.TARGET_EPOCH) : 100n;
const randomInboxIdsCount = process.env.RANDOM_INBOX_IDS ? parseInt(process.env.RANDOM_INBOX_IDS) : 30;
const installationCount = process.env.INSTALLATION_COUNT ? parseInt(process.env.INSTALLATION_COUNT) : 5;
const network = process.env.XMTP_ENV ?? "local";
const workerPrefix = process.env.WORKER_PREFIX ?? "random";
const workerCount = process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT) : 10;

const workerNames = Array.from({ length: workerCount }, (_, i) => `${workerPrefix}${i + 1}`);

const typeofStreamForTest = typeofStream.Message;
const typeOfResponseForTest = typeOfResponse.Gm;
const typeOfSyncForTest = typeOfSync.Both;

console.log("Running commits.test.ts with the following configuration:");
console.table({
  GROUP_COUNT: groupCount,
  PARALLEL_OPS: parallelOperations,
  TARGET_EPOCH: TARGET_EPOCH.toString(),
  RANDOM_INBOX_IDS: randomInboxIdsCount,
  INSTALLATION_COUNT: installationCount,
  network,
  WORKER_PREFIX: workerPrefix,
  WORKER_COUNT: workerCount,
  CHAOS_LATENCY_MS,
  CHAOS_JITTER_MS,
  CHAOS_PACKET_LOSS_PCT,
});

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
    if (!(CHAOS_LATENCY_MS || CHAOS_JITTER_MS || CHAOS_PACKET_LOSS_PCT)) {
      console.log("[chaos] Skipping chaos injection — all knobs set to 0");
      return () => { };
    }

    const nodes = DockerContainer.getNodes();
    if (nodes.length === 0) {
      console.warn("[chaos] No XMTP nodes detected - check environment!");
      return () => { };
    }

    console.log(`[chaos] Detected ${nodes.length} XMTP node(s): ${nodes.map(n => n.name).join(", ")}`);

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

    console.log("[chaos] Checking chaos connectivity between XMTP nodes via ping...");
    if (nodes.length > 1) {
      for (let i = 0; i < nodes.length; i++) {
        console.log(`[chaos] Host=>${nodes[i].name} ping`);
        nodes[i].pingFromHost();
        for (let j = i + 1; j < nodes.length; j++) {
          console.log(`[chaos] ${nodes[i].name}=>${nodes[j].name}`);
          nodes[i].ping(nodes[j]);
        }
      }
    } else {
      console.log(`[chaos] Host=>Single Node`);
      nodes[0].pingFromHost();

    }

    return () => {
      console.log("[chaos] Clearing netem on all XMTP nodes");
      for (const node of nodes) {
        node.clearLatency();
      }
    };
  };

  it("should perform concurrent operations with multiple users across groups", async () => {
    const workers = await getWorkers(
      workerNames,
      "commits",
      typeofStreamForTest,
      typeOfResponseForTest,
      typeOfSyncForTest,
      network as "local" | "dev" | "production"
    );

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
                console.log(`Group ${groupIndex + 1} operation failed:`, e);
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
