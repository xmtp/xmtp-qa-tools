import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
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
});
