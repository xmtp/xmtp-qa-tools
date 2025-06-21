import { getFixedNames, getManualUsers } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "commits";
const workerCount = 10;
const testConfig = {
  testName: testName,
  groupName: `Group ${getTime()}`,
  manualUsers: getManualUsers([(process.env.XMTP_ENV as string) + "-testing"]),
  randomInboxIds: getRandomInboxIds(workerCount * 10, 5),
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(workerCount), // Increased workers for better concurrency
} as const;

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let group: Group;

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should perform 100 epoch changes with concurrent operations from multiple users", async () => {
    try {
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
        testConfig.randomInboxIds.slice(0, 10), // Start with fewer members
      )) as Group;

      console.debug(`Created group: ${group.id}`);

      // Add manual users and worker members
      await group.addMembers(testConfig.manualUsers.map((u) => u.inboxId));

      for (const worker of workers.getAllButCreator()) {
        await group.addMembers([worker.client.inboxId]);
        await group.addSuperAdmin(worker.client.inboxId);
      }
      const allWorkers = workers.getAll();
      const availableMembers = testConfig.randomInboxIds.slice(workerCount); // Members not in group yet

      // Function to simulate random delay (realistic user behavior)
      const randomDelay = () =>
        new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

      // Function to perform name updates
      const performNameUpdates = async (worker: Worker, startIndex: number) => {
        for (let i = startIndex; i < startIndex + 10; i++) {
          await randomDelay();
          try {
            const workerGroup =
              (await worker.client.conversations.getConversationById(
                group.id,
              )) as Group;
            const newName = `${testConfig.groupName} - ${worker.name} Update ${i}`;
            await workerGroup.updateName(newName);
            console.log(`${worker.name}: Updated group name to: ${newName}`);
          } catch (e) {
            console.error(`${worker.name}: Error updating name:`, e);
          }
        }
      };

      // Function to perform member operations
      const performMemberOperations = async (
        worker: Worker,
        memberPool: string[],
        startIndex: number,
      ) => {
        for (let i = startIndex; i < startIndex + 10; i++) {
          await randomDelay();
          try {
            const workerGroup =
              (await worker.client.conversations.getConversationById(
                group.id,
              )) as Group;
            const memberIndex = (i * 2) % memberPool.length;
            const memberToAdd = memberPool[memberIndex];
            const memberToRemove =
              memberPool[(memberIndex + 1) % memberPool.length];

            // Add member
            await workerGroup.addMembers([memberToAdd]);
            console.log(`${worker.name}: Added member: ${memberToAdd}`);

            await randomDelay();

            // Remove different member
            await workerGroup.removeMembers([memberToRemove]);
            console.log(`${worker.name}: Removed member: ${memberToRemove}`);
          } catch (e) {
            console.error(`${worker.name}: Error in member operation:`, e);
          }
        }
      };

      // Function to send messages
      const performMessaging = async (worker: Worker, startIndex: number) => {
        for (let i = startIndex; i < startIndex + 15; i++) {
          await randomDelay();
          try {
            const workerGroup =
              (await worker.client.conversations.getConversationById(
                group.id,
              )) as Group;
            const message = `Message ${i} from ${worker.name}`;
            await workerGroup.send(message);
            console.log(`${worker.name}: Sent message: ${message}`);
          } catch (e) {
            console.error(`${worker.name}: Error sending message:`, e);
          }
        }
      };

      // Function to perform periodic syncs and status checks
      const performStatusChecks = async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
          try {
            await group.sync();
            const members = await group.members();

            let totalGroupInstallations = 0;
            for (const member of members) {
              totalGroupInstallations += member.installationIds.length;
            }

            const epoch = await group.debugInfo();
            console.log(
              `Status Check ${i + 1}: Members: ${members.length} - Epoch: ${epoch.epoch} - Maybe: ${epoch.maybeForked} - Installations: ${totalGroupInstallations}`,
            );
            await workers.checkForks();
          } catch (e) {
            console.error(`Error in status check ${i + 1}:`, e);
          }
        }
      };

      console.log("Starting concurrent operations...");

      // Create concurrent operations
      const operations = [
        // Name updates from different workers
        performNameUpdates(allWorkers[0], 0),
        performNameUpdates(allWorkers[1], 10),

        // Member operations from different workers with different member pools
        performMemberOperations(
          allWorkers[2],
          availableMembers.slice(0, 10),
          0,
        ),
        performMemberOperations(
          allWorkers[3],
          availableMembers.slice(10, 20),
          10,
        ),

        // Messaging from multiple workers
        performMessaging(allWorkers[4], 0),
        performMessaging(allWorkers[5], 15),
        performMessaging(allWorkers[6], 30),

        // Status monitoring
        performStatusChecks(),
      ];

      // Run all operations concurrently
      await Promise.all(operations);

      console.log("Completed all concurrent operations successfully");

      // Final status check
      await group.sync();
      const finalMembers = await group.members();
      const finalEpoch = await group.debugInfo();
      console.log(
        `Final Status: Members: ${finalMembers.length} - Epoch: ${finalEpoch.epoch} - Maybe: ${finalEpoch.maybeForked}`,
      );
    } catch (error) {
      console.error("Error performing concurrent commits:", error);
      throw error;
    }
  });
});
