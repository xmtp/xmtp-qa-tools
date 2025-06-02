import { getTime } from "@helpers/logger";
import { appendToEnv, getManualUsers, getRandomInboxIds } from "@helpers/utils";
import { type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";

export type TestFeature =
  | "verifyMessageStream"
  | "verifyMembershipStream"
  | "verifyAddInstallations"
  | "verifyMetadataStream"
  | "verifyEpochChange";

export interface GroupConfig {
  group: Group;
  features: TestFeature[];
  groupNumber: number;
}

export async function loadExistingGroups(
  creator: Worker,
): Promise<GroupConfig[]> {
  const existingGroups = getExistingGroupIds();
  if (existingGroups.length === 0) {
    console.debug("No existing groups found in .env");
    return [];
  }

  console.debug(`Loading ${existingGroups.length} existing groups from .env`);
  await creator.client.conversations.syncAll();

  const groupConfigs: GroupConfig[] = [];
  for (let i = 0; i < existingGroups.length; i++) {
    const group = (await creator.client.conversations.getConversationById(
      existingGroups[i],
    )) as Group;

    if (!group) {
      console.warn(`Group ${existingGroups[i]} not found, skipping`);
      continue;
    }

    await group.sync();
    groupConfigs.push({
      group,
      features: getRandomFeatures(),
      groupNumber: i + 1,
    });
  }
  return groupConfigs;
}

export async function createNewGroups(
  workers: WorkerManager,
  creator: Worker,
  startIndex: number,
): Promise<GroupConfig[]> {
  const groupsToCreate = 5 - startIndex;
  console.debug(`Creating ${groupsToCreate} new groups`);

  await creator.client.conversations.syncAll();
  const manualUsers = getManualUsers(["fabri-tba"]);
  const allInboxIds = [
    ...workers.getAllBut("bot").map((w) => w.client.inboxId),
    manualUsers[0].inboxId,
    ...getRandomInboxIds(60),
  ];

  const groupConfigs: GroupConfig[] = [];
  for (let i = startIndex; i < 5; i++) {
    const groupName = `Group ${getTime()} #${i + 1}`;

    const group = (await creator.client.conversations.newGroup([], {
      groupName: groupName,
      groupDescription: `Test group ${i + 1} of 5`,
    })) as Group;

    await group.sync();
    saveGroupToEnv(group.id);

    try {
      await group.addMembers(allInboxIds);
      await group.addSuperAdmin(manualUsers[0].inboxId);
    } catch (e) {
      console.error(`Error setting up group ${i + 1}:`, e);
    }

    groupConfigs.push({
      group,
      features: getRandomFeatures(),
      groupNumber: i + 1,
    });
  }
  return groupConfigs;
}

export async function createSingleNewGroup(
  workers: WorkerManager,
  creator: Worker,
  groupNumber: number,
): Promise<GroupConfig> {
  console.debug(`Creating 1 new group (${groupNumber})`);

  await creator.client.conversations.syncAll();
  const manualUsers = getManualUsers(["fabri-tba"]);
  const allInboxIds = [
    ...workers.getAllBut("bot").map((w) => w.client.inboxId),
    manualUsers[0].inboxId,
    ...getRandomInboxIds(60),
  ];

  const groupName = `Group ${getTime()} #${groupNumber}`;

  const group = (await creator.client.conversations.newGroup([], {
    groupName: groupName,
    groupDescription: `Test group ${groupNumber} - New this run`,
  })) as Group;

  await group.sync();
  saveGroupToEnv(group.id);

  try {
    await group.addMembers(allInboxIds);
    await group.addSuperAdmin(manualUsers[0].inboxId);
  } catch (e) {
    console.error(`Error setting up new group ${groupNumber}:`, e);
  }

  return {
    group,
    features: getRandomFeatures(),
    groupNumber,
  };
}

function getRandomFeatures(): TestFeature[] {
  const allFeatures: TestFeature[] = [
    "verifyMessageStream",
    "verifyMembershipStream",
    "verifyAddInstallations",
    "verifyMetadataStream",
    "verifyEpochChange",
  ];
  const numFeatures = Math.floor(Math.random() * 4) + 1; // 1-4 features
  const shuffled = allFeatures.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numFeatures);
}
export const getExistingGroupIds = (): string[] => {
  try {
    const groupsString = process.env.CREATED_GROUPS;
    if (!groupsString || groupsString.trim() === "") {
      return [];
    }

    // Parse comma-separated group IDs
    return groupsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  } catch (error) {
    console.warn("Failed to parse CREATED_GROUPS from .env:", error);
    return [];
  }
};

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

// it(`should verify all operations across all groups`, async () => {
//   try {
//     for (const config of groupConfigs) {
//       console.debug(JSON.stringify(config, null, 2));
//       const epoch = await workers.checkIfGroupForked(config.group.id);

//       for (const feature of config.features) {
//         switch (feature) {
//           case "verifyAddInstallations":
//             await verifyAddInstallations(workers, config.group.id);
//             break;

//           case "verifyMessageStream":
//             await verifyMessageStream(
//               config.group,
//               workers.getAllBut("bot"),
//               1,
//               `Message verification from group ${config.groupNumber} epoch ${epoch}`,
//             );
//             break;

//           case "verifyMembershipStream":
//             await verifyMembershipStream(
//               config.group,
//               workers.getAllBut("bot"),
//               getRandomInboxIds(1),
//             );
//             break;

//           case "verifyMetadataStream":
//             await verifyMetadataStream(
//               config.group,
//               workers.getAllBut("bot"),
//               1,
//               `${testConfig.groupName} #${config.groupNumber} - Updated`,
//             );
//             break;

//           case "verifyEpochChange":
//             await verifyEpochChange(workers, config.group.id);
//             break;
//         }

//         console.debug(`Group ${config.groupNumber} - Completed: ${feature}`);
//       }

//       await workers.checkIfGroupForked(config.group.id);
//     }
//   } catch (error) {
//     console.error("Error in test:", error);
//     throw error;
//   }
// });
