import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const groupCount = 5;
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
const TARGET_EPOCH = 100n;
// const randomInboxIdsCount = 30;
// const installationCount = 5;
// const randomInboxIds = getRandomInboxIds(
//   randomInboxIdsCount,
//   installationCount,
// );
//
const typeofStreamForTest = typeofStream.Message; // Starts a streamAllMessages in each worker
const typeOfSyncForTest = typeOfSync.Both; // Sync all every 5 seconds

describe("commits", async () => {
  let workers = await getWorkers(
    workerNames,
    "commits",
    typeofStreamForTest,
    typeOfResponse.None,
    typeOfSyncForTest,
  );

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
    const allWorkers = workers.getAll();

    const groupOperationPromises = Array.from(
      { length: groupCount },
      async (_, groupIndex) => {
        const group = await workers.createGroup();
        let currentEpoch = 0n;
        while (currentEpoch < TARGET_EPOCH) {
          const randomWorker =
            allWorkers[Math.floor(Math.random() * allWorkers.length)];

          const ops = createOperations(randomWorker, group, []);
          const operationList = [
            ops.updateName,
            // ops.addMember,
            ops.sendMessage,
            // ops.removeMember,
            // ops.createInstallation,
          ];

          const randomOperation =
            operationList[Math.floor(Math.random() * operationList.length)];

          try {
            await randomOperation();
          } catch (e) {
            console.log(`Group ${groupIndex + 1} operation failed:`, e);
          }

          await workers.checkForksForGroup(group.id);
          currentEpoch = (await group.debugInfo()).epoch;
        }

        return { groupIndex, finalEpoch: currentEpoch };
      },
    );
    await Promise.all(groupOperationPromises);
  });
});
