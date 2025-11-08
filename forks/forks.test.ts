import { getTime } from "@helpers/logger";
import { type Group } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, it } from "vitest";
import { DockerContainer } from "../network-stability/container";
import {
  chaosConfig,
  chaosPresets,
  epochRotationOperations,
  groupCount,
  installationCount,
  multinodeContainers,
  network,
  NODE_VERSION,
  otherOperations,
  parallelOperations,
  randomInboxIdsCount,
  targetEpoch,
  testName,
  workerNames,
} from "./config";

describe(testName, () => {
  setupDurationTracking({ testName });

  const createOperations = async (worker: Worker, group: Group) => {
    // This syncs all and can contribute to the fork
    await worker.client.conversations.syncAll();

    // Fetches the group from the worker perspective
    const getGroup = () =>
      worker.client.conversations.getConversationById(
        group.id,
      ) as Promise<Group>;

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
    };
  };

  it("perform concurrent operations with multiple users across 5 groups", async () => {
    // Initialize chaos variables in outer scope for cleanup
    let allNodes: DockerContainer[] = [];
    let chaosInterval: NodeJS.Timeout | undefined;
    let verifyInterval: NodeJS.Timeout | undefined;

    try {
      let workers = await getWorkers(workerNames, {
        env: network as "local" | "dev" | "production",
        nodeBindings: NODE_VERSION,
      });
      // Note: typeofStreamForTest and typeOfSyncForTest are set to None, so no streams or syncs to start

      // Initialize network chaos if enabled
      if (chaosConfig.enabled) {
        console.log("[chaos] Network chaos enabled");
        console.log(`[chaos] Level: ${chaosConfig.level}`);

        // Initialize Docker containers for multinode setup
        allNodes = multinodeContainers.map((name) => new DockerContainer(name));
        console.log(`[chaos] Initialized ${allNodes.length} Docker containers`);

        // Validate containers are running
        for (const node of allNodes) {
          try {
            // Test if container exists by trying to get its IP
            if (!node.ip) {
              throw new Error(`Container ${node.name} has no IP address`);
            }
          } catch (_err) {
            throw new Error(
              `Docker container ${node.name} is not running. Network chaos requires local multinode setup (./dev/up).`,
            );
          }
        }
        console.log("[chaos] All Docker containers validated");

        const preset = chaosPresets[chaosConfig.level];

        // Function to apply chaos to all nodes
        const applyChaos = () => {
          console.log(
            "[chaos] Applying jitter, delay, and drop rules to all nodes...",
          );
          for (const node of allNodes) {
            const delay = Math.floor(
              preset.delayMin +
                Math.random() * (preset.delayMax - preset.delayMin),
            );
            const jitter = Math.floor(
              preset.jitterMin +
                Math.random() * (preset.jitterMax - preset.jitterMin),
            );
            const loss =
              preset.lossMin +
              Math.random() * (preset.lossMax - preset.lossMin);

            try {
              node.addJitter(delay, jitter);
              if (Math.random() < 0.5) node.addLoss(loss);
            } catch (err) {
              console.warn(
                `[chaos] Error applying netem on ${node.name}:`,
                err,
              );
            }
          }
        };

        // Apply chaos immediately
        applyChaos();

        // Then set interval for continued chaos
        chaosInterval = setInterval(applyChaos, preset.interval);
        console.log(`[chaos] Started chaos interval (${preset.interval}ms)`);

        // Start periodic verification during chaos
        const verifyLoop = () => {
          verifyInterval = setInterval(() => {
            void (async () => {
              try {
                console.log("[verify] Checking forks under chaos");
                await workers.checkForks();
              } catch (e) {
                console.warn("[verify] Skipping check due to exception:", e);
              }
            })();
          }, 10 * 1000);
        };

        verifyLoop();
        console.log("[chaos] Started verification interval (10000ms)");
      }

      // Create groups
      const groupOperationPromises = Array.from(
        { length: groupCount },
        async (_, groupIndex) => {
          const group = await workers.createGroupBetweenAll();

          let currentEpoch = 0n;

          while (currentEpoch < targetEpoch) {
            const parallelOperationsArray = Array.from(
              { length: parallelOperations },
              () =>
                (async () => {
                  const randomWorker =
                    workers.getAll()[
                      Math.floor(Math.random() * workers.getAll().length)
                    ];

                  const ops = await createOperations(randomWorker, group);
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
                    console.log(`Group ${groupIndex + 1} operation failed:`, e);
                  }
                })(),
            );
            await Promise.all(parallelOperationsArray);
            await workers.checkForksForGroup(group.id);
            currentEpoch = (await group.debugInfo()).epoch;
          }

          return { groupIndex, finalEpoch: currentEpoch };
        },
      );

      await Promise.all(groupOperationPromises);
    } finally {
      // Clean up chaos if it was enabled
      if (chaosConfig.enabled) {
        console.log("[chaos] Cleaning up network chaos...");

        // Clear intervals
        if (chaosInterval) {
          clearInterval(chaosInterval);
        }
        if (verifyInterval) {
          clearInterval(verifyInterval);
        }

        // Clear network rules
        for (const node of allNodes) {
          try {
            node.clearLatency();
          } catch (err) {
            console.warn(
              `[chaos] Error clearing latency on ${node.name}:`,
              err,
            );
          }
        }

        // Cooldown period to allow in-flight messages to be processed
        console.log("[chaos] Waiting 5s cooldown before final validation");
        await new Promise((r) => setTimeout(r, 5000));

        console.log("[chaos] Cleanup complete");
      }
    }
  });
});
