import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const groupCount = 5;
const TARGET_EPOCH = 100n;
const workerNames = [
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

describe("commits", () => {
  let workers: WorkerManager;
  let creator: Worker;

  setupTestLifecycle({
    testName: "commits",
    expect,
  });

  it("should perform concurrent operations with multiple users across 5 groups", async () => {
    workers = await getWorkers(workerNames, "commits");
    creator = workers.getCreator();

    const allWorkers = workers.getAll();

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
          try {
            const randomWorker =
              allWorkers[Math.floor(Math.random() * allWorkers.length)];

            await randomWorker.client.conversations.syncAll();
            const groupFromWorker =
              (await randomWorker.client.conversations.getConversationById(
                group.id,
              )) as Group;

            await groupFromWorker.updateName(
              `${getTime()} - ${randomWorker.name}`,
            );
          } catch (e) {
            console.log(`Group ${groupIndex + 1} operation failed:`, e);
          }

          await group.sync();
          const debugInfo = await group.debugInfo();
          currentEpoch = debugInfo.epoch;
          if (currentEpoch % 20n === 0n) {
            console.log(`Group ${groupIndex + 1} - Epoch: ${currentEpoch} `);
          }
          if (debugInfo.maybeForked) {
            console.log(`Group ${groupIndex + 1} forked`);
            break;
          }
        }

        return { groupIndex, finalEpoch: currentEpoch };
      },
    );
    await Promise.all(groupOperationPromises);
  });
});
