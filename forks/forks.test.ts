import { getTime } from "@helpers/logger";
import { type Group } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, expect, it } from "vitest";
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
  streamsEnabled,
  targetEpoch,
  testName,
  workerNames,
} from "./config";
import { clearChaos, startChaos } from "./utils";

describe(testName, () => {
  setupDurationTracking({ testName });

  const createOperations = (worker: Worker, group: Group) => {
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
      sync: () => getGroup().then((g) => g.sync()),
    };
  };

  it("perform concurrent operations with multiple users across 5 groups", async () => {
    // Initialize chaos variables in outer scope for cleanup
    let allNodes: DockerContainer[] = [];
    let chaosInterval: NodeJS.Timeout | undefined;
    let verifyInterval: NodeJS.Timeout | undefined;
    let mustFail = false;

    try {
      let workers = await getWorkers(workerNames, {
        env: network as "local" | "dev" | "production",
        nodeBindings: NODE_VERSION,
      });

      // Enable message streams if configured
      if (streamsEnabled) {
        console.log("[streams] Enabling message streams on all workers");
        workers.getAll().forEach((worker) => {
          worker.worker.startStream(typeofStream.Message);
        });
      }

      // Initialize network chaos if enabled
      if (chaosConfig.enabled) {
        console.log("[chaos] Network chaos enabled");
        console.log(`[chaos] Level: ${chaosConfig.level}`);

        // Initialize Docker containers for multinode setup
        allNodes = multinodeContainers.map((name) => new DockerContainer(name));
        const preset = chaosPresets[chaosConfig.level];
        // Then set interval for continued chaos
        chaosInterval = startChaos(allNodes, preset);
        console.log(`[chaos] Started chaos interval (${preset.interval}ms)`);
      }

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
      console.log("Started verification interval (10000ms)");

      // Create groups
      const groupOperationPromises = Array.from(
        { length: groupCount },
        async (_, groupIndex) => {
          const group = await workers.createGroupBetweenAll();

          let currentEpoch = 0n;
          await Promise.all(
            workers.getAll().map((w) => w.client.conversations.sync()),
          );

          while (currentEpoch < targetEpoch) {
            const parallelOperationsArray = Array.from(
              { length: parallelOperations },
              () =>
                (async () => {
                  const randomWorker =
                    workers.getAll()[
                      Math.floor(Math.random() * workers.getAll().length)
                    ];

                  const ops = createOperations(randomWorker, group);
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
            try {
              await Promise.all(parallelOperationsArray);
            } catch (e) {
              console.error(`Group ${groupIndex + 1} operation failed:`, e);
            }

            await workers.checkForksForGroup(group.id);
            currentEpoch = (await group.debugInfo()).epoch;
          }

          return { groupIndex, finalEpoch: currentEpoch };
        },
      );

      await Promise.all(groupOperationPromises);
      await workers.checkForks();
    } catch (e: any) {
      console.error("Error during fork testing:", e);
      mustFail = true;
    } finally {
      if (verifyInterval) {
        clearInterval(verifyInterval);
      }
      // Clean up chaos if it was enabled
      if (chaosConfig.enabled) {
        console.log("[chaos] Cleaning up network chaos...");
        // Clear intervals
        if (chaosInterval) {
          clearInterval(chaosInterval);
        }

        clearChaos(allNodes);

        console.log("[chaos] Cleanup complete");
      }

      if (mustFail) {
        expect.fail(`Test failed`);
      }
    }
  });
});
