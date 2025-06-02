import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  appendToEnv,
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
  workerNames: getFixedNames(4),
  freshInstalls: false, // more installs
  totalGroups: 5, // Number of groups to create
} as const;

// Available test features
type TestFeature =
  | "verifyMessageStream"
  | "verifyMembershipStream"
  | "verifyAddInstallations"
  | "verifyMetadataStream"
  | "verifyEpochChange";

interface GroupConfig {
  group: Group;
  features: TestFeature[];
  groupNumber: number;
}

// Function to randomly select 1-4 features for each group
function getRandomFeatures(): TestFeature[] {
  const allFeatures: TestFeature[] = [
    "verifyMessageStream",
    "verifyAddInstallations",
    "verifyEpochChange",
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

      // Check for existing groups first
      const existingGroups = getGroupsForTest(testConfig.testName);
      console.debug(
        `Found ${existingGroups.length} existing groups for test ${testConfig.testName}`,
      );

      if (existingGroups.length >= testConfig.totalGroups) {
        console.debug(
          `Using existing ${existingGroups.length} groups from .env`,
        );

        // Sync creator's conversations to get the groups
        await creator.client.conversations.syncAll();

        // Load existing groups into groupConfigs
        for (let i = 0; i < testConfig.totalGroups; i++) {
          const storedGroup = existingGroups[i];
          const group = (await creator.client.conversations.getConversationById(
            storedGroup.id,
          )) as Group;

          if (group) {
            await group.sync();
            const features = getRandomFeatures();
            console.debug(
              `Group ${i + 1} (${storedGroup.name}) assigned features: ${features.join(", ")}`,
            );

            groupConfigs.push({
              group,
              features,
              groupNumber: i + 1,
            });
          } else {
            console.warn(
              `Could not find group ${storedGroup.id} in conversations, will create new one`,
            );
            break;
          }
        }
      }

      // Create remaining groups if needed
      const groupsToCreate = testConfig.totalGroups - groupConfigs.length;
      if (groupsToCreate > 0) {
        console.debug(
          `Creating ${groupsToCreate} new groups (${groupConfigs.length} already exist)`,
        );
        console.debug("Worker inbox ids", testConfig.workerNames);

        const manualUsers = getManualUsers(["fabri-tba"]);

        // Sync creator's conversations first
        console.debug(`Syncing creator's ${creator.name} conversations`);
        await creator.client.conversations.syncAll();
        const manualUser = manualUsers[0];
        const randomInboxIds = getRandomInboxIds(60);
        const allInboxIds = [
          ...workers.getAllBut("bot").map((w) => w.client.inboxId),
          manualUser.inboxId,
          ...randomInboxIds,
        ];

        // Create remaining groups
        for (let i = groupConfigs.length; i < testConfig.totalGroups; i++) {
          const groupName = `${testConfig.groupName} #${i + 1}`;
          console.debug(
            `Creating group ${i + 1}/${testConfig.totalGroups}: ${groupName}`,
          );

          // Create new group
          const group = (await creator.client.conversations.newGroup([], {
            groupName: groupName,
            groupDescription: `Test group ${i + 1} of ${testConfig.totalGroups}`,
          })) as Group;

          await group.sync();
          console.debug(`Group ${i + 1} created with ID: ${group.id}`);

          // Save group to .env
          saveGroupToEnv(group.id);

          try {
            await group.addMembers(allInboxIds);
          } catch (e) {
            console.error(`Error adding members to group ${i + 1}:`, e);
          }

          for (const inboxId of manualUsers.map((u) => u.inboxId)) {
            console.debug(`Adding super admin ${inboxId} to group ${i + 1}`);
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
      }

      console.debug(
        `Successfully prepared ${groupConfigs.length} groups (${existingGroups.length} existing, ${groupsToCreate} newly created)`,
      );
      return groupConfigs;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it(`should verify fork-free operations across ${testConfig.totalGroups} groups`, async () => {
    try {
      for (const config of groupConfigs) {
        const { group, features, groupNumber } = config;

        console.debug(
          `\n=== TESTING GROUP ${groupNumber}/${testConfig.totalGroups} ===`,
        );
        console.debug(`Group ID: ${group.id}`);
        console.debug(`Features to test: ${features.join(", ")}`);

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
            case "verifyAddInstallations":
              await verifyAddInstallations(workers, group.id);
              break;

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

            case "verifyEpochChange":
              await verifyEpochChange(workers, group.id);
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
      }
    } catch (error) {
      console.error("Error in test:", error);
      throw error;
    }
  });
});

/**
 * Saves a group ID to the .env file as comma-separated values
 */
export const saveGroupToEnv = (groupId: string): void => {
  try {
    const existingGroupsString = process.env.CREATED_GROUPS || "";
    const existingIds = existingGroupsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Add new group ID if it doesn't already exist
    if (!existingIds.includes(groupId)) {
      const newGroupsString =
        existingIds.length > 0 ? `${existingGroupsString},${groupId}` : groupId;

      appendToEnv("CREATED_GROUPS", newGroupsString);
      console.debug(`Saved group ID ${groupId} to .env`);
    } else {
      console.debug(`Group ID ${groupId} already exists in .env`);
    }
  } catch (error) {
    console.error("Failed to save group to .env:", error);
  }
};

export interface StoredGroup {
  id: string;
  name: string;
  testName: string;
  timestamp: string;
  createdBy: string;
}

/**
 * Gets existing groups from .env file
 */
export const getExistingGroups = (): StoredGroup[] => {
  try {
    const groupsString = process.env.CREATED_GROUPS;
    if (!groupsString || groupsString.trim() === "") {
      return [];
    }

    // Parse comma-separated group IDs
    const groupIds = groupsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Convert to StoredGroup objects with minimal data
    return groupIds.map((id, index) => ({
      id,
      name: `Group ${index + 1}`,
      testName: "group", // Default test name
      timestamp: new Date().toISOString(),
      createdBy: "unknown",
    }));
  } catch (error) {
    console.warn("Failed to parse CREATED_GROUPS from .env:", error);
    return [];
  }
};

/**
 * Checks if a group with the given name and test name already exists
 */
export const checkGroupExists = (
  groupName: string,
  testName: string,
): StoredGroup | null => {
  const existingGroups = getExistingGroups();
  return (
    existingGroups.find(
      (g) => g.name === groupName && g.testName === testName,
    ) || null
  );
};

export async function verifyAddInstallations(
  workers: WorkerManager,
  groupId: string,
): Promise<void> {
  try {
    console.debug(`Creating -b installations for all workers...`);

    // Get all current worker names (excluding bot)
    const currentWorkerNames = workers.getAllBut("bot").map((w) => w.name);

    // Create new workers with -b installation IDs
    const bWorkerPromises = currentWorkerNames.map((name) =>
      workers.createWorker(`${name}-b`),
    );

    const bWorkers = await Promise.all(bWorkerPromises);
    console.debug(`Created ${bWorkers.length} -b installations`);

    // Get the group and add all -b workers
    const creator = workers.get("bot");
    if (!creator) {
      throw new Error("Bot creator not found");
    }

    const group = (await creator.client.conversations.getConversationById(
      groupId,
    )) as Group;
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Add all -b workers to the group
    const bWorkerInboxIds = bWorkers.map((w) => w.client.inboxId);
    console.debug(`Adding ${bWorkerInboxIds.length} -b workers to group...`);

    // Add in smaller batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < bWorkerInboxIds.length; i += batchSize) {
      const batch = bWorkerInboxIds.slice(i, i + batchSize);
      await group.addMembers(batch);
      console.debug(`Added -b worker batch ${Math.floor(i / batchSize) + 1}`);
    }

    await group.sync();

    // Test membership changes by removing and re-adding some -b workers
    const workersToTest = bWorkerInboxIds.slice(
      0,
      Math.min(3, bWorkerInboxIds.length),
    );

    console.debug(
      `Testing membership changes with ${workersToTest.length} -b workers...`,
    );

    // Remove workers
    for (const inboxId of workersToTest) {
      await group.removeMembers([inboxId]);
      console.debug(`Removed -b worker: ${inboxId}`);
    }

    await group.sync();

    // Re-add workers
    for (const inboxId of workersToTest) {
      await group.addMembers([inboxId]);
      console.debug(`Re-added -b worker: ${inboxId}`);
    }

    await group.sync();

    const finalMembers = await group.members();
    console.debug(
      `Group now has ${finalMembers.length} total members (including -b installations)`,
    );
  } catch (error) {
    console.error("Error in testMembershipChanges:", error);
    throw error;
  }
}

export async function verifyEpochChange(
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

/**
 * Gets groups for a specific test
 */
const getGroupsForTest = (testName: string): StoredGroup[] => {
  const existingGroups = getExistingGroups();
  return existingGroups.filter((g) => g.testName === testName);
};
