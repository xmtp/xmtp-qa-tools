import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { loadEnv } from "dev/helpers/client";
import { getTime } from "dev/helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "dev/helpers/streams";
import {
  appendToEnv,
  getFixedNames,
  getManualUsers,
  getRandomInboxIds,
} from "dev/helpers/utils";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getRandomFeatures,
  verifyEpochChange,
  type GroupConfig,
} from "./helper";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  manualUsers: getManualUsers(["fabri-tba"]),
  network: "production",
  preInstallations: 10,
  randomInboxIds: 60,
  typeofStream: typeofStream.None,
  typeOfResponse: typeOfResponse.None,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(40),
  freshInstalls: false,
} as const;

loadEnv(TEST_NAME);

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let groupConfigs: GroupConfig[] = [];

  setupTestLifecycle({ expect });

  beforeAll(async () => {
    // Initialize workers
    workers = await getWorkers(
      ["bot", ...testConfig.workerNames],
      testConfig.testName,
      testConfig.typeofStream,
      testConfig.typeOfResponse,
      testConfig.typeOfSync,
      testConfig.network,
      testConfig.preInstallations,
    );
    creator = workers.get("bot") as Worker;

    // Load all existing groups
    const existingGroups =
      process.env.CREATED_GROUPS?.split(",").filter((id) => id.trim()) || [];
    console.debug(`Loaded ${existingGroups.length} existing groups`);

    // Create new group and update environment
    const group = (await creator.client.conversations.newGroup([])) as Group;
    await group.sync();

    const updatedGroups = [...existingGroups, group.id];
    appendToEnv("CREATED_GROUPS", updatedGroups.join(","));
    console.debug(`Created new group: ${group.id}`);

    // Create group configs with proper numbering
    groupConfigs = await Promise.all(
      updatedGroups.map(async (groupId, index) => ({
        group: (await creator.client.conversations.getConversationById(
          groupId,
        )) as Group,
        features: getRandomFeatures(Math.floor(Math.random() * 4) + 1),
        groupNumber: index + 1,
      })),
    );

    const allInboxIds = [
      ...workers.getAllBut("bot").map((w) => w.client.inboxId),
      testConfig.manualUsers.flatMap((u) => u.inboxId),
      ...getRandomInboxIds(testConfig.randomInboxIds),
    ];

    await creator.client.conversations.syncAll();

    // Add members in slices of 5
    for (let i = 0; i < allInboxIds.length; i += 5) {
      const slice = allInboxIds.slice(i, i + 5);
      try {
        await group.addMembers(slice as string[]);
        await group.sync();
      } catch (e) {
        console.error(`Error adding members to group ${group.id}:`, e);
      }
    }

    await group.addAdmin(testConfig.manualUsers[0].inboxId);
    await group.sync();
  });

  it(`should verify all operations across all groups`, async () => {
    try {
      for (const config of groupConfigs) {
        console.debug(JSON.stringify(config, null, 2));
        await workers.checkForks();

        for (const feature of config.features) {
          switch (feature) {
            case "verifyMessageStream":
              await verifyMessageStream(
                config.group,
                workers.getAllBut("bot"),
                1,
                `Message verification from group ${config.groupNumber}`,
              );
              break;

            case "verifyMembershipStream":
              await verifyMembershipStream(
                config.group,
                workers.getAllBut("bot"),
                getRandomInboxIds(1),
              );
              break;

            case "verifyMetadataStream":
              await verifyMetadataStream(
                config.group,
                workers.getAllBut("bot"),
                1,
                `${testConfig.groupName} #${config.groupNumber} - Updated`,
              );
              break;

            case "verifyEpochChange":
              await verifyEpochChange(
                workers,
                config.group.id,
                testConfig.epochs,
              );
              break;
          }

          console.debug(`Group ${config.groupNumber} - Completed: ${feature}`);
        }

        await workers.checkForks();
      }
    } catch (error) {
      console.error("Error in test:", error);
      throw error;
    }
  });
});
