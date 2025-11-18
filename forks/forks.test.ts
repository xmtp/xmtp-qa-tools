import { DbChaos } from "@chaos/db";
import { ExpandGroup } from "@chaos/expand";
import { NetworkChaos } from "@chaos/network";
import type { ChaosProvider } from "@chaos/provider";
import { StreamsChaos } from "@chaos/streams";
import { getTime } from "@helpers/logger";
import { type Group } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { DockerContainer } from "@network-stability/container";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";
import {
  epochRotationOperations,
  getConfigFromEnv,
  installationCount,
  maxConsecutiveFailures,
  multinodeContainers,
  NODE_VERSION,
  otherOperations,
  randomInboxIdsCount,
  testName,
  workerNames,
} from "./config";

const {
  groupCount,
  parallelOperations,
  network,
  targetEpoch,
  networkChaos,
  dbChaos,
  groupExpansion,
  backgroundStreams,
} = getConfigFromEnv();

const createOperations = (worker: Worker, groupID: string) => {
  const getGroup = async () => {
    const group =
      await worker.client.conversations.getConversationById(groupID);
    if (!group) {
      throw new Error(`Group ${groupID} not found`);
    }
    return group as Group;
  };

  return {
    updateName: () =>
      getGroup().then((g) =>
        g.updateName(`${getTime()} - ${worker.name} Update`),
      ),
    createInstallation: () =>
      getGroup().then(() => worker.worker.addNewInstallation()),
    addMember: () =>
      getGroup().then((g) => {
        const randomInboxIds = getInboxes(
          randomInboxIdsCount,
          installationCount,
        );
        return g.addMembers([
          randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)]
            .inboxId,
        ]);
      }),

    removeMember: () =>
      getGroup().then((g) => {
        const randomInboxIds = getInboxes(
          randomInboxIdsCount,
          installationCount,
        );
        return g.removeMembers([
          randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)]
            .inboxId,
        ]);
      }),
    sendMessage: () =>
      getGroup().then((g) =>
        g.send(`Message from ${worker.name}`).then(() => {}),
      ),
    sync: () => getGroup().then((g) => g.sync()),
  };
};

const startChaos = async (workers: WorkerManager): Promise<ChaosProvider[]> => {
  let chaosProviders: ChaosProvider[] = [];

  // Set up chaos providers based on config
  if (networkChaos) {
    const containers = multinodeContainers.map(
      (name) => new DockerContainer(name),
    );
    chaosProviders.push(new NetworkChaos(networkChaos, containers));
  }

  if (dbChaos) {
    chaosProviders.push(new DbChaos(dbChaos));
  }

  if (backgroundStreams) {
    chaosProviders.push(new StreamsChaos(backgroundStreams));
  }

  if (groupExpansion) {
    chaosProviders.push(new ExpandGroup({ interval: groupExpansion.interval }));
  }

  // Start all chaos providers
  for (const provider of chaosProviders) {
    await provider.start(workers);
  }

  return chaosProviders;
};

describe(testName, () => {
  setupDurationTracking({ testName });

  it("perform concurrent operations with multiple users across 5 groups", async () => {
    let workers = await getWorkers(workerNames, {
      env: network as "local" | "dev" | "production",
      nodeBindings: NODE_VERSION,
    });

    // Create the groups before starting any chaos
    let groupIDs = await Promise.all(
      Array.from({ length: groupCount }).map(
        async () => (await workers.createGroupBetweenAll()).id,
      ),
    );

    // Make sure everyone has the group before starting
    await Promise.all(
      workers.getAll().map((w) => w.client.conversations.sync()),
    );

    const chaosProviders = await startChaos(workers);

    let verifyInterval = setInterval(() => {
      void (async () => {
        try {
          console.log("[verify] Checking forks under chaos");
          await workers.checkForks();
        } catch (e) {
          console.warn("[verify] Skipping check due to exception:", e);
        }
      })();
    }, 10 * 1000);

    console.log("Started verification interval (10000ms)");

    try {
      // Create groups
      const groupOperationPromises = groupIDs.map(
        async (groupID, groupIndex) => {
          let currentEpoch = 0n;
          let numConsecutiveFailures = 0;

          // Run until we reach the target epoch or we hit 5 consecutive failures.
          while (currentEpoch < targetEpoch) {
            const parallelOperationsArray = Array.from(
              { length: parallelOperations },
              () =>
                (async () => {
                  const randomWorker =
                    workers.getAll()[
                      Math.floor(Math.random() * workers.getAll().length)
                    ];

                  const ops = createOperations(randomWorker, groupID);
                  const operationList = [
                    ...(epochRotationOperations.updateName
                      ? [ops.updateName]
                      : []),
                    ...(epochRotationOperations.addMember
                      ? [ops.addMember]
                      : []),
                    ...(epochRotationOperations.removeMember
                      ? [ops.removeMember]
                      : []),
                  ];
                  const otherOperationList = [
                    ...(otherOperations.createInstallation
                      ? [ops.createInstallation]
                      : []),
                    ...(otherOperations.sendMessage ? [ops.sendMessage] : []),
                    ...(otherOperations.sync ? [ops.sync] : []),
                  ];

                  const randomOperation =
                    operationList[
                      Math.floor(Math.random() * operationList.length)
                    ];
                  const otherRandomOperation =
                    otherOperationList[
                      Math.floor(Math.random() * otherOperationList.length)
                    ];
                  try {
                    await randomOperation();
                    await otherRandomOperation();
                  } catch (e) {
                    console.error(
                      `Group ${groupIndex + 1} operation failed:`,
                      e,
                    );
                  }
                })(),
            );

            // We want to wait for all operations to complete, but ignore any errors which may be caused by the chaos
            const results = await Promise.allSettled(parallelOperationsArray);
            for (const result of results) {
              if (result.status === "rejected") {
                console.error(
                  `Group ${groupIndex + 1} operation failed:`,
                  result.reason,
                );
              }
            }

            try {
              await workers.checkForksForGroup(groupID);
              const group = await workers
                .getCreator()
                .client.conversations.getConversationById(groupID);
              if (!group) {
                throw new Error("Could not find group");
              }
              currentEpoch = (await group.debugInfo()).epoch;
              numConsecutiveFailures = 0;
            } catch (e) {
              console.error(`Group ${groupIndex + 1} operation failed:`, e);
              numConsecutiveFailures++;
              if (numConsecutiveFailures >= maxConsecutiveFailures) {
                throw e;
              }
            }
          }

          return { groupIndex, finalEpoch: currentEpoch };
        },
      );

      await Promise.all(groupOperationPromises);
    } catch (e: any) {
      const msg = `Error during fork testing: ${e}`;
      console.error(msg);
      // This will fail the test if there were too many failures
      expect.fail(msg);
    } finally {
      clearInterval(verifyInterval);

      for (const chaosProvider of chaosProviders) {
        await chaosProvider.stop();
      }
      // Check for forks one last time, with all chaos turned off to ensure the check can succeed.
      await workers.checkForks();
    }
  });
});
