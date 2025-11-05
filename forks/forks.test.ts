import { getTime } from "@helpers/logger";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { type Group } from "@helpers/versions";
import { describe, it } from "vitest";
import {
  epochRotationOperations,
  groupCount,
  installationCount,
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
    let workers = await getWorkers(workerNames, {
      env: network as "local" | "dev" | "production",
      nodeBindings: NODE_VERSION,
    });
    // Note: typeofStreamForTest and typeOfSyncForTest are set to None, so no streams or syncs to start
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
                  ...(epochRotationOperations.addMember ? [ops.addMember] : []),
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
  });
});
