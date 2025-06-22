import { getRandomNames } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "commits";
const workerCount = 6;
const groupCount = 5;
const batchSize = 4; // Smaller batch per group since we have 5 groups running in parallel
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
  workerNames: getRandomNames(workerCount),
} as const;

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let groups: Group[];

  setupTestLifecycle({
    testName,
    expect,
  });

  // Create operation factories
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
        getGroup().then((g) => worker.worker.addNewInstallation()),
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
    // Initialize workers
    workers = await getWorkers(
      testConfig.workerNames,
      testConfig.testName,
      testConfig.typeofStream,
      testConfig.typeOfResponse,
      testConfig.typeOfSync,
    );
    creator = workers.getCreator();

    // Create 5 groups and set them up in parallel
    console.log(`Creating and setting up ${groupCount} groups in parallel...`);
    const groupCreationPromises = Array.from(
      { length: groupCount },
      async (_, i) => {
        // Create group
        const group = (await creator.client.conversations.newGroup(
          testConfig.randomInboxIds,
        )) as Group;

        for (const worker of workers.getAllButCreator()) {
          await group.addMembers([worker.client.inboxId]);
          await group.addSuperAdmin(worker.client.inboxId);
        }

        return group;
      },
    );

    groups = await Promise.all(groupCreationPromises);
    console.log(`Created and set up ${groups.length} groups successfully`);

    const allWorkers = workers.getAll();
    const availableMembers = testConfig.randomInboxIds;

    // Run commit operations for each group in parallel
    console.log("Starting parallel commit operations for all groups...");
    const groupOperationPromises = groups.map(async (group, groupIndex) => {
      let currentEpoch = 0n;
      let operationCount = 0;

      // Keep running operations until this specific group reaches epoch 100+
      while (currentEpoch < TARGET_EPOCH) {
        // Create batch of operations for this specific group
        const parallelOperations = Array.from({ length: batchSize }, (_, i) =>
          (async () => {
            // Select random worker for this group
            const randomWorker =
              allWorkers[Math.floor(Math.random() * allWorkers.length)];

            // Create operations for the selected worker and this specific group
            const ops = createOperations(randomWorker, group, availableMembers);
            const operationList = [
              ops.updateName,
              ops.addMember,
              ops.sendMessage,
              ops.removeMember,
              ops.createInstallation,
            ];

            // Select random operation
            const randomOperation =
              operationList[Math.floor(Math.random() * operationList.length)];

            try {
              await randomOperation();
              console.log(
                `Group ${groupIndex + 1} Operation ${operationCount + i + 1}: ${randomWorker.name} completed operation`,
              );
            } catch (e) {
              console.log(
                `Group ${groupIndex + 1} Operation ${operationCount + i + 1}: ${randomWorker.name} failed:`,
                e,
              );
            }
          })(),
        );

        // Run batch of operations in parallel for this group
        await Promise.all(parallelOperations);
        operationCount += batchSize;

        // Check current epoch for this specific group
        await group.sync();
        const epoch = await group.debugInfo();
        currentEpoch = epoch.epoch;

        // Status update for this group
        const members = await group.members();
        let totalGroupInstallations = 0;
        for (const member of members) {
          totalGroupInstallations += member.installationIds.length;
        }

        console.log(
          `Group ${groupIndex + 1} - Operations: ${operationCount} - Members: ${members.length} - Epoch: ${currentEpoch}/${TARGET_EPOCH} - Maybe: ${epoch.maybeForked} - Installations: ${totalGroupInstallations}`,
        );
      }

      console.log(
        `Group ${groupIndex + 1} completed! Final epoch: ${currentEpoch} after ${operationCount} operations`,
      );

      return { groupIndex, finalEpoch: currentEpoch, operationCount };
    });

    // Wait for all groups to complete
    const results = await Promise.all(groupOperationPromises);

    const totalOperations = results.reduce(
      (sum, result) => sum + result.operationCount,
      0,
    );
    console.log(
      `All groups completed! Total operations across all groups: ${totalOperations}`,
    );

    results.forEach(({ groupIndex, finalEpoch, operationCount }) => {
      console.log(
        `Group ${groupIndex + 1}: ${finalEpoch} epochs, ${operationCount} operations`,
      );
    });
  });
});
