import { getFixedNames, getManualUsers } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "commits";
const workerCount = 6;
const testConfig = {
  testName,
  groupName: `Group ${getTime()}`,
  manualUsers: getManualUsers([(process.env.XMTP_ENV as string) + "-testing"]),
  randomInboxIds: getRandomInboxIds(workerCount * 5, 5),
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(workerCount),
} as const;

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let group: Group;

  setupTestLifecycle({
    testName,
    expect,
  });
  // Status monitoring
  const statusCheck = async () => {
    await group.sync();
    const members = await group.members();
    const epoch = await group.debugInfo();
    let totalGroupInstallations = 0;
    for (const member of members) {
      totalGroupInstallations += member.installationIds.length;
    }
    console.log(
      `Members: ${members.length} - Epoch: ${epoch.epoch} - Maybe: ${epoch.maybeForked} - Installations: ${totalGroupInstallations}`,
    );
  };

  // Create operation factories
  const createOperations = (worker: Worker, availableMembers: string[]) => {
    const getGroup = () =>
      worker.client.conversations.getConversationById(
        group.id,
      ) as Promise<Group>;

    return {
      updateName: () =>
        getGroup().then((g) =>
          g.updateName(`${testConfig.groupName} - ${worker.name} Update`),
        ),
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

  it("should perform concurrent operations with multiple users", async () => {
    // Initialize workers and group
    workers = await getWorkers(
      testConfig.workerNames,
      testConfig.testName,
      testConfig.typeofStream,
      testConfig.typeOfResponse,
      testConfig.typeOfSync,
    );
    creator = workers.getCreator();

    group = (await creator.client.conversations.newGroup(
      testConfig.randomInboxIds,
    )) as Group;

    // Setup group with workers as super admins
    await group.addMembers(testConfig.manualUsers.map((u) => u.inboxId));
    for (const worker of workers.getAllButCreator()) {
      await group.addMembers([worker.client.inboxId]);
      await group.addSuperAdmin(worker.client.inboxId);
    }

    const allWorkers = workers.getAll();
    const availableMembers = testConfig.randomInboxIds;

    let currentEpoch = 0n;
    let operationCount = 0;
    const TARGET_EPOCH = 100n;

    // Keep running operations until we reach epoch 100+
    while (currentEpoch < TARGET_EPOCH) {
      // Create batch of 20 parallel operations
      const batchSize = 20;
      const parallelOperations = Array.from({ length: batchSize }, (_, i) =>
        (async () => {
          // Select random worker
          const randomWorker =
            allWorkers[Math.floor(Math.random() * allWorkers.length)];

          // Create operations for the selected worker
          const ops = createOperations(randomWorker, availableMembers);
          const operationList = [
            ops.updateName,
            ops.addMember,
            ops.sendMessage,
            ops.removeMember,
          ];

          // Select random operation
          const randomOperation =
            operationList[Math.floor(Math.random() * operationList.length)];

          try {
            await randomOperation();
            console.log(
              `Operation ${operationCount + i + 1}: ${randomWorker.name} completed operation`,
            );
          } catch (e) {
            console.log(
              `Operation ${operationCount + i + 1}: ${randomWorker.name} failed:`,
              e,
            );
          }
        })(),
      );

      // Run batch of operations in parallel
      await Promise.all(parallelOperations);
      operationCount += batchSize;

      // Check current epoch after batch
      await statusCheck();
      const epoch = await group.debugInfo();
      currentEpoch = epoch.epoch;

      console.log(
        `Completed ${operationCount} operations. Current epoch: ${currentEpoch}/${TARGET_EPOCH}`,
      );
    }

    console.log(
      `Target reached! Final epoch: ${currentEpoch} after ${operationCount} operations`,
    );
  });
});
