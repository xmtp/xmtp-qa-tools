import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "commits";
const groupCount = 5;
const batchSize = 4;
const TARGET_EPOCH = 100n;
const randomInboxIdsCount = 30;
const installationCount = 5;
const testConfig = {
  testName,
  groupName: `Group ${getTime()}`,
  randomInboxIds: getRandomInboxIds(randomInboxIdsCount, installationCount),
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  workerNames: [
    "random1",
    "random2",
    "random3",
    "random4",
    "random5",
  ] as string[],
} as const;

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;

  setupTestLifecycle({
    testName,
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
          g.updateName(`${testConfig.groupName} - ${worker.name} Update`),
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
      testConfig.workerNames,
      testConfig.testName,
      testConfig.typeofStream,
      testConfig.typeOfResponse,
      testConfig.typeOfSync,
    );
    creator = workers.getCreator();

    const allWorkers = workers.getAll();
    const availableMembers = testConfig.randomInboxIds;

    const groupOperationPromises = Array.from(
      { length: groupCount },
      async (_, groupIndex) => {
        const group = (await creator.client.conversations.newGroup(
          testConfig.randomInboxIds,
        )) as Group;

        for (const worker of workers.getAllButCreator()) {
          await group.addMembers([worker.client.inboxId]);
          await group.addSuperAdmin(worker.client.inboxId);
        }

        let currentEpoch = 0n;
        let operationCount = 0;

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
          operationCount += batchSize;

          await group.sync();
          const epoch = await group.debugInfo();
          const members = await group.members();
          let totalGroupInstallations = 0;
          for (const member of members) {
            totalGroupInstallations += member.installationIds.length;
          }
          currentEpoch = epoch.epoch;

          if (operationCount % 20 === 0) {
            console.log(
              `Group ${groupIndex + 1} - Epoch: ${currentEpoch} - Members: ${members.length} - Installations: ${totalGroupInstallations}`,
            );
          }
        }

        return { groupIndex, finalEpoch: currentEpoch, operationCount };
      },
    );

    const results = await Promise.all(groupOperationPromises);

    const totalOperations = results.reduce(
      (sum, result) => sum + result.operationCount,
      0,
    );
    console.log(`Total operations: ${totalOperations}`);
  });
});
