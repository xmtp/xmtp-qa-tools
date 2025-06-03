import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getFixedNames, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createSingleNewGroup,
  loadExistingGroups,
  type GroupConfig,
} from "./helper";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
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
      typeofStream.Message,
      typeOfResponse.Gm,
      typeOfSync.Both,
      "local",
    );
    creator = workers.get("bot") as Worker;

    // Load all existing groups
    const existingGroups = await loadExistingGroups(creator);
    groupConfigs = [...existingGroups];

    console.debug(`Loaded ${groupConfigs.length} existing groups`);

    // Always create 1 new group per test run
    console.debug("Creating 1 new group for this test run...");
    const newGroup = await createSingleNewGroup(
      workers,
      creator,
      groupConfigs.length + 1,
    );
    groupConfigs.push(newGroup);

    console.debug(
      `Total groups for testing: ${groupConfigs.length} (${existingGroups.length} existing + 1 new)`,
    );
  });

  it(`should verify all operations across all groups`, async () => {
    try {
      for (const config of groupConfigs) {
        console.debug(JSON.stringify(config, null, 2));

        await verifyEpochChange(workers, config.group.id);

        await workers.checkIfGroupForked(config.group.id);
      }
    } catch (error) {
      console.error("Error in test:", error);
      throw error;
    }
  });
});

export async function verifyAddInstallations(
  workers: WorkerManager,
  groupId: string,
): Promise<void> {
  try {
    // Get all current workers (excluding bot)
    const currentWorkers = workers.getAllBut("bot");

    // Randomly select 30-50% of workers for multiple installations
    const selectionPercentage = 0.3 + Math.random() * 0.2; // 30-50%
    const numToSelect = Math.max(
      1,
      Math.floor(currentWorkers.length * selectionPercentage),
    );

    // Randomly select workers for multiple installations
    const selectedWorkers = currentWorkers
      .sort(() => 0.5 - Math.random())
      .slice(0, numToSelect);

    // Create 10 installations (letters a-j) for each selected worker
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    console.debug(
      `Creating 10 installations (${letters.join(", ")}) for ${selectedWorkers.length}/${currentWorkers.length} randomly selected workers...`,
    );

    // Create all installations and track replacements
    const allReplacements: Array<{
      originalWorker: Worker;
      newWorker: Worker;
      letter: string;
    }> = [];

    for (const worker of selectedWorkers) {
      for (const letter of letters) {
        const newWorker = await workers.createWorker(
          `${worker.name}-${letter}`,
        );
        console.debug(`Created -${letter} installation for ${worker.name}`);
        allReplacements.push({
          originalWorker: worker,
          newWorker: newWorker,
          letter: letter,
        });
      }
    }

    // Get the group
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

    // Add all new workers to the group
    const newWorkerInboxIds = allReplacements.map(
      (r) => r.newWorker.client.inboxId,
    );
    console.debug(`Adding ${newWorkerInboxIds.length} new workers to group...`);

    // Add in smaller batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < newWorkerInboxIds.length; i += batchSize) {
      const batch = newWorkerInboxIds.slice(i, i + batchSize);
      await group.addMembers(batch);
      console.debug(`Added worker batch ${Math.floor(i / batchSize) + 1}`);
    }

    await group.sync();

    // Replace the selected workers in the workers array with their new installations
    console.debug(`Updating workers array to use new installations...`);

    // Group replacements by original worker
    const replacementsByWorker = new Map<string, typeof allReplacements>();
    for (const replacement of allReplacements) {
      const workerName = replacement.originalWorker.name;
      if (!replacementsByWorker.has(workerName)) {
        replacementsByWorker.set(workerName, []);
      }
      replacementsByWorker.get(workerName)!.push(replacement);
    }

    // Replace each original worker with one of their new installations (randomly chosen)
    for (const [workerName, workerReplacements] of replacementsByWorker) {
      const randomReplacement =
        workerReplacements[
          Math.floor(Math.random() * workerReplacements.length)
        ];
      workers.addWorker(
        randomReplacement.originalWorker.name,
        randomReplacement.letter,
        randomReplacement.newWorker,
      );
      console.debug(
        `Replaced ${randomReplacement.originalWorker.name}-a with ${randomReplacement.originalWorker.name}-${randomReplacement.letter} in workers array`,
      );
    }

    // Verify the update worked
    const updatedWorkers = workers.getAllBut("bot");
    const newInstallationCount = allReplacements.length;
    console.debug(
      `Workers array now contains ${selectedWorkers.length} replaced workers from ${newInstallationCount} total new installations`,
    );

    // Test membership changes with some of the new workers
    const workersToTest = newWorkerInboxIds.slice(
      0,
      Math.min(3, newWorkerInboxIds.length),
    );

    console.debug(
      `Testing membership changes with ${workersToTest.length} new workers...`,
    );

    await group.sync();

    // Test remove and re-add for membership verification
    for (const inboxId of workersToTest) {
      try {
        await group.removeMembers([inboxId]);
        console.debug(`Temporarily removed worker: ${inboxId}`);
        await group.addMembers([inboxId]);
        console.debug(`Re-added worker: ${inboxId}`);
      } catch (e) {
        console.warn(`Error in membership test for ${inboxId}:`, e);
      }
    }

    await group.sync();

    const finalMembers = await group.members();
    console.debug(
      `Group now has ${finalMembers.length} total members (including ${newInstallationCount} new installations)`,
    );

    console.debug(
      `✅ Successfully created ${newInstallationCount} new installations for ${selectedWorkers.length} workers`,
    );
  } catch (error) {
    console.error("Error in verifyAddInstallations:", error);
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
