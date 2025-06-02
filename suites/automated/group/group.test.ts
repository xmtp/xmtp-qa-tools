import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { getFixedNames, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createNewGroups,
  loadExistingGroups,
  type GroupConfig,
} from "./helper";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  network:
    (process.env.XMTP_ENV as "production" | "local" | "dev") || "production",
  workerNames: getFixedNames(4),
  freshInstalls: false, // more installs
  totalGroups: 5, // Number of groups to create
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
      testConfig.network,
    );
    creator = workers.get("bot") as Worker;

    // Try to load existing groups first
    groupConfigs = await loadExistingGroups(creator);

    // Create remaining groups if needed
    if (groupConfigs.length < testConfig.totalGroups) {
      const newGroups = await createNewGroups(
        workers,
        creator,
        groupConfigs.length,
      );
      groupConfigs.push(...newGroups);
    }

    console.debug(`Prepared ${groupConfigs.length} groups for testing`);
  });

  let runs = 5;
  for (let i = 0; i < runs; i++) {
    it(`should verify all operations across ${testConfig.totalGroups} groups`, async () => {
      try {
        for (const config of groupConfigs) {
          const epoch = await workers.checkIfGroupForked(config.group.id);

          for (const feature of config.features) {
            switch (feature) {
              case "verifyAddInstallations":
                await verifyAddInstallations(workers, config.group.id);
                break;

              case "verifyMessageStream":
                await verifyMessageStream(
                  config.group,
                  workers.getAllBut("bot"),
                  1,
                  `Message verification from group ${config.groupNumber} epoch ${epoch}`,
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
                await verifyEpochChange(workers, config.group.id);
                break;
            }

            console.debug(
              `Group ${config.groupNumber} - Completed: ${feature}`,
            );
          }

          await workers.checkIfGroupForked(config.group.id);
        }
      } catch (error) {
        console.error("Error in test:", error);
        throw error;
      }
    });
  }
});

export async function verifyAddInstallations(
  workers: WorkerManager,
  groupId: string,
): Promise<void> {
  try {
    // Get all current workers (excluding bot)
    const currentWorkers = workers.getAllBut("bot");

    // Randomly select 30-50% of workers for -b installations
    const selectionPercentage = 0.3 + Math.random() * 0.2; // 30-50%
    const numToSelect = Math.max(
      1,
      Math.floor(currentWorkers.length * selectionPercentage),
    );

    // Randomly select workers for -b installations
    const selectedWorkers = currentWorkers
      .sort(() => 0.5 - Math.random())
      .slice(0, numToSelect);

    console.debug(
      `Creating -b installations for ${selectedWorkers.length}/${currentWorkers.length} randomly selected workers...`,
    );

    // Create -b workers and track replacements
    const replacementPromises = selectedWorkers.map(async (worker) => {
      const bWorker = await workers.createWorker(`${worker.name}-b`);
      console.debug(`Created -b installation for ${worker.name}`);
      return { originalWorker: worker, bWorker };
    });

    const replacements = await Promise.all(replacementPromises);

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

    // Add all -b workers to the group
    const bWorkerInboxIds = replacements.map((r) => r.bWorker.client.inboxId);
    console.debug(`Adding ${bWorkerInboxIds.length} -b workers to group...`);

    // Add in smaller batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < bWorkerInboxIds.length; i += batchSize) {
      const batch = bWorkerInboxIds.slice(i, i + batchSize);
      await group.addMembers(batch);
      console.debug(`Added -b worker batch ${Math.floor(i / batchSize) + 1}`);
    }

    await group.sync();

    // Replace the selected workers in the workers array with their -b counterparts
    console.debug(`Updating workers array to use -b installations...`);
    for (const { originalWorker, bWorker } of replacements) {
      // Add the -b worker to replace the original
      workers.addWorker(originalWorker.name, "b", bWorker);
      console.debug(
        `Replaced ${originalWorker.name}-a with ${originalWorker.name}-b in workers array`,
      );
    }

    // Verify the update worked
    const updatedWorkers = workers.getAllBut("bot");
    const bInstallationCount = updatedWorkers.filter(
      (w) => w.folder === "b",
    ).length;
    console.debug(
      `Workers array now contains ${bInstallationCount} -b installations and ${updatedWorkers.length - bInstallationCount} -a installations`,
    );

    // Test membership changes with some of the new -b workers
    const workersToTest = bWorkerInboxIds.slice(
      0,
      Math.min(3, bWorkerInboxIds.length),
    );

    console.debug(
      `Testing membership changes with ${workersToTest.length} -b workers...`,
    );

    await group.sync();

    // Test remove and re-add for membership verification
    for (const inboxId of workersToTest) {
      try {
        await group.removeMembers([inboxId]);
        console.debug(`Temporarily removed -b worker: ${inboxId}`);
        await group.addMembers([inboxId]);
        console.debug(`Re-added -b worker: ${inboxId}`);
      } catch (e) {
        console.warn(`Error in membership test for ${inboxId}:`, e);
      }
    }

    await group.sync();

    const finalMembers = await group.members();
    console.debug(
      `Group now has ${finalMembers.length} total members (including ${bInstallationCount} -b installations)`,
    );

    console.debug(
      `✅ Successfully updated ${replacements.length} workers to -b installations`,
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
