import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import {
  getFixedNames,
  getManualUsers,
  getRandomInboxIds,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getExistingGroupIds,
  saveGroupToEnv,
  verifyEpochChange,
  type GroupConfig,
} from "./helper";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  manualUsers: getManualUsers(["fabri-tba"]),
  network: "local",
  preInstallations: 10,
  randomInboxIds: 60,
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(40),
  freshInstalls: false, // more installs
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
    const existingGroups = getExistingGroupIds();
    groupConfigs = await Promise.all(
      existingGroups.map(async (groupId) => ({
        group: (await creator.client.conversations.getConversationById(
          groupId,
        )) as Group,
        features: ["verifyEpochChange"],
        groupNumber: groupConfigs.length + 1,
      })),
    );

    console.debug(`Loaded ${groupConfigs.length} existing groups`);
    if (groupConfigs.length > 0) {
      console.debug(
        `Existing group IDs: ${groupConfigs.map((g) => g.group.id).join(", ")}`,
      );
    }
    const allInboxIds = [
      ...workers.getAllBut("bot").map((w) => w.client.inboxId),
      testConfig.manualUsers[0].inboxId,
      ...getRandomInboxIds(testConfig.randomInboxIds),
    ];
    // Always create 1 new group per test run
    console.debug("Creating 1 new group for this test run...");

    await creator.client.conversations.syncAll();

    const group = (await creator.client.conversations.newGroup([])) as Group;

    await group.sync();
    saveGroupToEnv(group.id);

    for (const inboxId of allInboxIds) {
      try {
        await group.addMembers([inboxId]);
        await group.addAdmin(inboxId);
        await group.sync();
      } catch (e) {
        console.error(
          `Error adding member ${inboxId} to group ${groupConfigs.length + 1}:`,
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

        await verifyEpochChange(workers, config.group.id, testConfig.epochs);

        await workers.checkIfGroupForked(config.group.id);
      }
    } catch (error) {
      console.error("Error in test:", error);
      throw error;
    }
  });
});
