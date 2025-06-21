import { getFixedNames, getManualUsers } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "commits";
const workerCount = 6; // Reduced for simplicity
const testConfig = {
  testName,
  groupName: `Group ${getTime()}`,
  manualUsers: getManualUsers([(process.env.XMTP_ENV as string) + "-testing"]),
  randomInboxIds: getRandomInboxIds(workerCount * 5, 3),
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

  // Generic operation runner with random delays
  const runOperations = async (
    worker: Worker,
    operations: (() => Promise<void>)[],
  ) => {
    for (const operation of operations) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));
      try {
        await operation();
      } catch (e) {
        console.log(`${worker.name}: Operation failed:`, e);
      }
    }
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
      testConfig.randomInboxIds.slice(0, 5),
    )) as Group;

    // Setup group with workers as super admins
    await group.addMembers(testConfig.manualUsers.map((u) => u.inboxId));
    for (const worker of workers.getAllButCreator()) {
      await group.addMembers([worker.client.inboxId]);
      await group.addSuperAdmin(worker.client.inboxId);
    }

    const allWorkers = workers.getAll();
    const availableMembers = testConfig.randomInboxIds.slice(workerCount);

    // Create and run concurrent operations
    const concurrentTasks = allWorkers
      .slice(0, 4)
      .map(async (worker, index) => {
        const ops = createOperations(worker, availableMembers);
        const operationList = [
          ops.updateName,
          ops.addMember,
          ops.sendMessage,
          ...(index % 2 === 0 ? [ops.removeMember] : []),
        ];
        return runOperations(worker, operationList);
      });

    // Status monitoring
    const statusCheck = async () => {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await group.sync();
        const members = await group.members();
        const epoch = await group.debugInfo();
        console.log(
          `Status ${i + 1}: Members: ${members.length} - Epoch: ${epoch.epoch}`,
        );
      }
    };

    // Run all operations concurrently
    await Promise.all([...concurrentTasks, statusCheck()]);

    // Final verification
    await group.sync();
    const finalMembers = await group.members();
    const finalEpoch = await group.debugInfo();
    console.log(
      `Final Status: Members: ${finalMembers.length} - Epoch: ${finalEpoch.epoch} - Maybe: ${finalEpoch.maybeForked}`,
    );

    expect(finalMembers.length).toBeGreaterThan(0);
  });
});
