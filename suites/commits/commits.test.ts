import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

// Count of groups to create
const groupCount = 5;
const parallelOperations = 1; // How many operations to perform in parallel

// By calling workers with prefix random1, random2, etc. we guarantee that creates a new key each run
// We want to create a key each run to ensure the forks are "pure"
const workerNames = [
  "random1",
  "random2",
  "random3",
  "random4",
  "random5",
] as string[];

// Operations configuration - enable/disable specific operations
const enabledOperations = {
  updateName: true, // updates the name of the group
  sendMessage: true, // sends a message to the group
  addMember: true, // adds a random member to the group
  removeMember: true, // removes a random member from the group
  createInstallation: true, // creates a new installation for a random worker
};
const targetEpoch = 50n; // The target epoch to stop the test (epochs are when performing commits to the group)
const network = process.env.XMTP_ENV; // Network environment setting
const randomInboxIdsCount = 30; // How many inboxIds to use randomly in the add/remove operations
const installationCount = 5; // How many installations to use randomly in the createInstallation operations
const typeofStreamForTest = typeofStream.None; // Starts a streamAllMessages in each worker
const typeOfResponseForTest = typeOfResponse.None; // Replies gm if mentioned
const typeOfSyncForTest = typeOfSync.None; // Sync all every 5 seconds

describe("commits", () => {
  setupTestLifecycle({
    testName: "commits",
    expect,
  });

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
          const randomInboxIds = getRandomInboxIds(
            randomInboxIdsCount,
            installationCount,
          );
          return g.addMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]);
        }),
      removeMember: () =>
        getGroup().then((g) => {
          const randomInboxIds = getRandomInboxIds(
            randomInboxIdsCount,
            installationCount,
          );
          return g.removeMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]);
        }),
      sendMessage: () =>
        getGroup().then((g) =>
          g.send(`Message from ${worker.name}`).then(() => {}),
        ),
    };
  };

  it("should perform concurrent operations with multiple users across 5 groups", async () => {
    let workers = await getWorkers(
      workerNames,
      "commits",
      typeofStreamForTest,
      typeOfResponseForTest,
      typeOfSyncForTest,
      network as "local" | "dev" | "production",
    );
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
                  ...(enabledOperations.updateName ? [ops.updateName] : []),
                  ...(enabledOperations.sendMessage ? [ops.sendMessage] : []),
                  ...(enabledOperations.addMember ? [ops.addMember] : []),
                  ...(enabledOperations.removeMember ? [ops.removeMember] : []),
                  ...(enabledOperations.createInstallation
                    ? [ops.createInstallation]
                    : []),
                ];

                const randomOperation =
                  operationList[
                    Math.floor(Math.random() * operationList.length)
                  ];

                try {
                  await randomOperation();
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
