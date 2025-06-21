import { getFixedNames, getManualUsers } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "commits";
const testConfig = {
  testName: testName,
  groupName: `Group ${getTime()}`,
  manualUsers: getManualUsers([(process.env.XMTP_ENV as string) + "-testing"]),
  randomInboxIds: getRandomInboxIds(40),
  typeofStream: typeofStream.None,
  typeOfResponse: typeOfResponse.None,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(5),
} as const;

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let group: Group;

  setupTestLifecycle({
    testName,
    expect,
  });

  beforeAll(async () => {
    // Initialize workers
    workers = await getWorkers(
      testConfig.workerNames,
      testConfig.testName,
      testConfig.typeofStream,
      testConfig.typeOfResponse,
      testConfig.typeOfSync,
    );
    creator = workers.getCreator();

    // Create a single group for testing
    group = (await creator.client.conversations.newGroup(
      testConfig.randomInboxIds,
    )) as Group;

    console.debug(`Created group: ${group.id}`);

    // Add manual users and worker members
    await group.addMembers(testConfig.manualUsers.map((u) => u.inboxId));
    await group.addMembers(
      workers.getAllButCreator().map((w) => w.client.inboxId),
    );
  });

  it("should perform 100 epoch changes (name updates and member add/remove)", async () => {
    try {
      for (let i = 0; i < 100; i++) {
        console.log(`Performing commit ${i + 1}/100`);

        // Alternate between name updates and member operations
        if (i % 2 === 0) {
          // Update group name
          const newName = `${testConfig.groupName} - Update ${i + 1}`;
          await group.updateName(newName);
          console.debug(`Updated group name to: ${newName}`);
        } else {
          // Add and remove a random member
          const randomMember = testConfig.randomInboxIds[i % 2];
          try {
            await group.addMembers([randomMember]);
            console.debug(`Added member: ${randomMember}`);

            // Remove the same member
            await group.removeMembers([randomMember]);
            console.debug(`Removed member: ${randomMember}`);
          } catch (e) {
            console.error(`Error in member operation ${i + 1}:`, e);
          }
        }

        // Sync the group after each operation
        await group.sync();
        const members = await group.members();
        const epoch = await group.debugInfo();
        console.log(`Members: ${members.length} - Epoch: ${epoch.epoch}`);
        await workers.checkForks();
      }

      console.log("Completed all 100 commits successfully");
    } catch (error) {
      console.error("Error performing commits:", error);
      throw error;
    }
  });
});
