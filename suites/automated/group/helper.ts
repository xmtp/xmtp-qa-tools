import { getTime } from "@helpers/logger";
import { appendToEnv, getRandomInboxIds } from "@helpers/utils";
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

export async function verifyEpochChange(
  workers: WorkerManager,
  groupId: string,
  epochs: number,
): Promise<void> {
  for (let i = 0; i < epochs; i++) {
    const randomAdmin =
      workers.getAllBut("bot")[
        Math.floor(Math.random() * workers.getAllBut("bot").length)
      ];
    let group = (await randomAdmin.client.conversations.getConversationById(
      groupId,
    )) as Group;

    // Check if group was found before proceeding
    if (!group) {
      await randomAdmin.client.conversations.syncAll();
      group = (await randomAdmin.client.conversations.getConversationById(
        groupId,
      )) as Group;

      if (!group) {
        console.warn(
          `Group ${groupId} still not found for worker ${randomAdmin.name} after sync, skipping epoch cycle ${i}`,
        );
        continue;
      }
    }

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

export const getExistingGroupIds = (): string[] => {
  try {
    const groupsString = process.env.CREATED_GROUPS;
    if (!groupsString || groupsString.trim() === "") {
      return [];
    }

    // Remove surrounding quotes if they exist and parse comma-separated group IDs
    const cleanedString = groupsString.replace(/^"(.*)"$/, "$1");
    return cleanedString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  } catch (error) {
    console.warn("Failed to parse CREATED_GROUPS from .env:", error);
    return [];
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
