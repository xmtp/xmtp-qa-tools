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
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyEpochChange, type GroupConfig } from "./helper";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  manualUsers: getManualUsers(["fabri-tba"]),
  network: "production",
  preInstallations: 20,
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

  setupTestLifecycle({
    expect,
  });

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
        features: ["verifyEpochChange"],
        groupNumber: index + 1,
      })),
    );

    const allInboxIds = [
      ...workers.getAllBut("bot").map((w) => w.client.inboxId),
      testConfig.manualUsers[0].inboxId,
      ...getRandomInboxIds(testConfig.randomInboxIds),
    ];

    await creator.client.conversations.syncAll();

    // Add members to the newly created group only
    for (const inboxId of allInboxIds) {
      try {
        await group.addMembers([inboxId]);
        await group.addAdmin(inboxId);
        await group.sync();
      } catch (e) {
        console.error(
          `Error adding member ${inboxId} to group ${group.id}:`,
          e,
        );
      }
    }

    console.debug(
      `Total groups for testing: ${groupConfigs.length} (${existingGroups.length} existing + 1 new)`,
    );
    console.debug(
      `All group IDs: ${groupConfigs.map((g) => g.group.id).join(", ")}`,
    );
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
