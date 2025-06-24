import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const groupCount = 5;
const parallelOperations = 1; // How many operations to perform in parallel
const workerNames = [
  // By calling workers with prefix random1, random2, etc. we guarantee that creates a new key each run
  // We want to create a key each run to ensure the forks are "pure"
  "random1",
  "random2",
  "random3",
  "random4",
  "random5",
  "random6",
  "random7",
  "random8",
  "random9",
  "random10",
] as string[];

//The target of epoch to stop the test, epochs are when performing commits to the group
const TARGET_EPOCH = 100n;
const network = process.env.XMTP_ENV;
// How many inboxIds to use randomly in the add/remove opps
const randomInboxIdsCount = 30;
// How many installations to use randomly in the createInstallation opps
const installationCount = 5;
const typeofStreamForTest = typeofStream.Message; // Starts a streamAllMessages in each worker
const typeOfResponseForTest = typeOfResponse.Gm; // Replies gm if mentioned
const typeOfSyncForTest = typeOfSync.Both; // Sync all every 5 seconds

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

    const randomInboxIds: string[] = getRandomInboxIds(
      randomInboxIdsCount,
      installationCount,
    );
    return {
      updateName: () =>
        getGroup().then((g) =>
          g.updateName(`${getTime()} - ${worker.name} Update`),
        ),
      createInstallation: () =>
        getGroup().then(() => worker.worker.addNewInstallation()),
      addMember: () =>
        getGroup().then((g) =>
          g.addMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]),
        ),
      removeMember: () =>
        getGroup().then((g) =>
          g.removeMembers([
            randomInboxIds[Math.floor(Math.random() * randomInboxIds.length)],
          ]),
        ),
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
    const creator = workers.getCreator();

    // Get all workers
    const allWorkers = workers.getAll();

    // Create groups
    const groupOperationPromises = Array.from(
      { length: groupCount },
      async (_, groupIndex) => {
        const group = (await creator.client.conversations.newGroup(
          [],
        )) as Group;

        for (const worker of workers.getAllButCreator()) {
          await group.addMembers([worker.client.inboxId]);
          await group.addSuperAdmin(worker.client.inboxId);
        }

        let currentEpoch = 0n;

        while (currentEpoch < TARGET_EPOCH) {
          const parallelOperations = Array.from({ length: batchSize }, () =>
            (async () => {
              const randomWorker =
                allWorkers[Math.floor(Math.random() * allWorkers.length)];

              const ops = await createOperations(randomWorker, group);
              const operationList = [
                ops.updateName,
                ops.sendMessage,
                ops.addMember,
                ops.removeMember,
                ops.createInstallation,
              ];

              const randomOperation =
                operationList[Math.floor(Math.random() * operationList.length)];

              try {
                await randomOperation();
              } catch (e) {
                console.log(`Group ${groupIndex + 1} operation failed:`, e);
              }
            })(),
          );

          await Promise.all(parallelOperations);
          await workers.checkForksForGroup(group.id);
          currentEpoch = (await group.debugInfo()).epoch;
        }

        return { groupIndex, finalEpoch: currentEpoch };
      },
    );
    await Promise.all(groupOperationPromises);
  });
});
