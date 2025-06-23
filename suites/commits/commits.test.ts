import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const groupCount = 5;
const batchSize = 4;
const TARGET_EPOCH = 100n;
const randomInboxIdsCount = 30;
const installationCount = 5;
const randomInboxIds = getRandomInboxIds(
  randomInboxIdsCount,
  installationCount,
);
const typeofStreamForTest = typeofStream.Message; // Stream all messages
const typeOfSyncForTest = typeOfSync.Both; // Sync all every 5 seconds
const workerNames = [
  "random1",
  "random2",
  "random3",
  "random4",
  "random5",
] as string[];

describe("commits", () => {
  let workers: WorkerManager;
  let creator: Worker;

  setupTestLifecycle({
    testName: "commits",
    expect,
  });

  const createOperations = (
    worker: Worker,
    group: Group,
    availableMembers: string[],
  ) => {
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
        getGroup().then((g) =>
          g.addMembers([
            availableMembers[
              Math.floor(Math.random() * availableMembers.length)
            ],
          ]),
        ),
      removeMember: () =>
        getGroup().then((g) =>
          g.removeMembers([
            availableMembers[
              Math.floor(Math.random() * availableMembers.length)
            ],
          ]),
        ),
      sendMessage: () =>
        getGroup().then((g) =>
          g.send(`Message from ${worker.name}`).then(() => {}),
        ),
    };
  };

  it("should perform concurrent operations with multiple users across 5 groups", async () => {
    workers = await getWorkers(
      workerNames,
      "commits",
      typeofStreamForTest,
      typeOfResponse.None,
      typeOfSyncForTest,
    );
    creator = workers.getCreator();

    const allWorkers = workers.getAll();
    const availableMembers = randomInboxIds;

    const groupOperationPromises = Array.from(
      { length: groupCount },
      async (_, groupIndex) => {
        const group = (await creator.client.conversations.newGroup(
          randomInboxIds,
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

              const ops = createOperations(
                randomWorker,
                group,
                availableMembers,
              );
              const operationList = [
                ops.updateName,
                ops.addMember,
                ops.sendMessage,
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

          await group.sync();
          const epoch = await group.debugInfo();
          const members = await group.members();
          let totalGroupInstallations = 0;
          for (const member of members) {
            totalGroupInstallations += member.installationIds.length;
          }
          currentEpoch = epoch.epoch;

          if (currentEpoch % 20n === 0n) {
            console.log(
              `Group ${groupIndex + 1} - Epoch: ${currentEpoch} - Members: ${members.length} - Installations: ${totalGroupInstallations}`,
            );
          }
        }

        return { groupIndex, finalEpoch: currentEpoch };
      },
    );
    await Promise.all(groupOperationPromises);
  });
});
