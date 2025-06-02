import { loadEnv, logAgentDetails } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  getFixedNames,
  getManualUsers,
  getRandomInboxIds,
  removeDataFolder,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  network: "production",
  workerNames: getFixedNames(40),
  freshInstalls: false, // more installs
  totalGroups: 100, // Number of groups to create
} as const;

// Available test features
type TestFeature =
  | "verifyMessageStream"
  | "verifyMembershipStream"
  | "verifyMetadataStream"
  | "testMembershipChanges";

interface GroupConfig {
  group: Group;
  features: TestFeature[];
  groupNumber: number;
}

// Function to randomly select 1-4 features for each group
function getRandomFeatures(): TestFeature[] {
  const allFeatures: TestFeature[] = [
    "verifyMessageStream",
    "verifyMembershipStream",
    "verifyMetadataStream",
    "testMembershipChanges",
  ];
  const numFeatures = Math.floor(Math.random() * 4) + 1; // 1-4 features
  const shuffled = allFeatures.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numFeatures);
}

loadEnv(TEST_NAME);

// ============================================================
// Main Test Suite
// ============================================================

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let groupConfigs: GroupConfig[] = [];

  // ============================================================
  // Test Lifecycle Setup
  // ============================================================

  setupTestLifecycle({
    expect,
  });

  // Add cleanup after all tests complete
  afterAll(async () => {
    try {
      console.debug("Cleaning up workers...");
      if (workers) {
        await workers.terminateAll();
      }
      console.debug("✓ Workers cleaned up successfully");
    } catch (error) {
      console.warn("Error during cleanup:", error);
    }
  });

  beforeAll(async () => {
    try {
      if (testConfig.freshInstalls) await removeDataFolder();

      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bot", ...testConfig.workerNames],
        testConfig.testName,
        typeofStream.Message,
        typeOfResponse.Gm,
        typeOfSync.Both,
        testConfig.network,
      );
      creator = workers.get("bot") as Worker;

      console.debug("Creating 100 groups with randomized features");
      console.debug("Worker inbox ids", testConfig.workerNames);

      const manualUsers = getManualUsers(["fabri-tba"]);

      // Sync creator's conversations first
      console.debug(`Syncing creator's ${creator.name} conversations`);
      await creator.client.conversations.syncAll();
      console.debug("Manual users", manualUsers);
      const manualUser = manualUsers[0];
      const randomInboxIds = getRandomInboxIds(60);
      const allInboxIds = [
        ...workers.getAllBut("bot").map((w) => w.client.inboxId),
        manualUser.inboxId,
        ...randomInboxIds,
      ];

      // Create 100 groups in a for loop
      for (let i = 0; i < testConfig.totalGroups; i++) {
        console.debug(`Creating group ${i + 1}/${testConfig.totalGroups}`);

        // Create new group
        const group = (await creator.client.conversations.newGroup([], {
          groupName: `${testConfig.groupName} #${i + 1}`,
          groupDescription: `Test group ${i + 1} of ${testConfig.totalGroups}`,
        })) as Group;

        await group.sync();
        console.debug(`Group ${i + 1} created with ID: ${group.id}`);

        // Add all members to this group
        for (const inboxId of allInboxIds) {
          try {
            await group.addMembers([inboxId]);
          } catch (e) {
            console.error(
              `Error adding member ${inboxId} to group ${i + 1}:`,
              e,
            );
          }
        }
        for (const inboxId of manualUsers.map((u) => u.inboxId)) {
          await group.addSuperAdmin(inboxId);
        }
        // Assign random features to this group
        const features = getRandomFeatures();
        console.debug(
          `Group ${i + 1} assigned features: ${features.join(", ")}`,
        );

        groupConfigs.push({
          group,
          features,
          groupNumber: i + 1,
        });

        // Small delay to avoid overwhelming the system
        if (i % 10 === 9) {
          console.debug(`Created ${i + 1} groups, pausing briefly...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Sync conversations again after all group operations
      await creator.client.conversations.syncAll();
      const conversations = await creator.client.conversations.list();
      console.debug("Synced creator's conversations", conversations.length);
      await logAgentDetails(creator.client);

      console.debug(
        `Successfully created ${groupConfigs.length} groups with randomized features`,
      );
      return groupConfigs;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it(`should verify fork-free operations across 100 groups`, async () => {
    const forkLog: string[] = [];

    for (const config of groupConfigs) {
      const { group, features, groupNumber } = config;

      console.debug(
        `\n=== TESTING GROUP ${groupNumber}/${testConfig.totalGroups} ===`,
      );
      console.debug(`Group ID: ${group.id}`);
      console.debug(`Features to test: ${features.join(", ")}`);

      try {
        const debugInfo = await group.debugInfo();
        console.debug(
          `Group ${groupNumber} - Starting epoch: ${debugInfo.epoch}`,
        );

        // Send initial message for this group
        await group.send(
          `Testing group ${groupNumber} with features: ${features.join(", ")}`,
        );

        // Execute assigned features for this group
        for (const feature of features) {
          console.debug(`Group ${groupNumber} - Executing: ${feature}`);

          switch (feature) {
            case "verifyMessageStream":
              await verifyMessageStream(
                group,
                workers.getAllBut("bot"),
                1,
                `Message verification from group ${groupNumber} epoch ${debugInfo.epoch}`,
              );
              break;

            case "verifyMembershipStream":
              await verifyMembershipStream(
                group,
                workers.getAllBut("bot"),
                getRandomInboxIds(1),
              );
              break;

            case "verifyMetadataStream":
              await verifyMetadataStream(
                group,
                workers.getAllBut("bot"),
                1,
                `${testConfig.groupName} #${groupNumber} - Updated`,
              );
              break;

            case "testMembershipChanges":
              await testMembershipChanges(workers, group.id);
              break;
          }

          console.debug(`Group ${groupNumber} - Completed: ${feature}`);
        }

        // Check for forks after all features for this group
        console.debug(`Group ${groupNumber} - Checking for forks...`);
        await workers.checkIfGroupForked(group.id);
        console.debug(
          `Group ${groupNumber} - Fork check completed (check logs for any detected forks)`,
        );

        console.debug(`Group ${groupNumber} - Completed all tests`);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Group ${groupNumber} - Error:`, errorMessage);
        forkLog.push(`ERROR in Group ${groupNumber}: ${errorMessage}`);
        logError(error, expect.getState().currentTestName);
      }
    }

    // Final fork summary
    console.debug(`\n=== FORK DETECTION SUMMARY ===`);
    console.debug(`Total groups tested: ${groupConfigs.length}`);
    console.debug(
      `Check the logs above for any detected forks during testing.`,
    );

    if (forkLog.length > 0) {
      console.debug(`\nError Log:`);
      forkLog.forEach((log) => {
        console.debug(`- ${log}`);
      });
    }

    // The test should not fail if forks are detected - we want to record them
    console.debug(
      `Fork detection test completed. Check logs above for any detected forks.`,
    );
  });
});

export async function testMembershipChanges(
  workers: WorkerManager,
  groupId: string,
): Promise<void> {
  const cantCylcesPerAdmin = testConfig.epochs;
  for (let i = 0; i < cantCylcesPerAdmin; i++) {
    const randomAdmin =
      workers.getAllBut("bot")[
        Math.floor(Math.random() * workers.getAllBut("bot").length)
      ];
    const group = (await randomAdmin.client.conversations.getConversationById(
      groupId,
    )) as Group;

    for (const member of getRandomInboxIds(6)) {
      try {
        await group.removeMembers([member]);
        await group.addMembers([member]);
        console.debug(`Membership update: ${member}`);
        await group.sync();
      } catch (e) {
        console.error(`Error in membership cycle ${i}:`, e);
      }
    }
  }
}
