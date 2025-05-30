import { loadEnv, logAgentDetails } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  appendToEnv,
  checkIfGroupForked,
  getFixedNames,
  getManualUsers,
  getRandomInboxIds,
  removeDataFolder,
} from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ============================================================
// Test Configuration
// ============================================================

const TEST_NAME = "not-forked";
const testConfig = {
  testName: TEST_NAME,
  groupName: `NotForked ${getTime()}`,
  epochs: 3,
  network: "production",
  workerNames: getFixedNames(10),
  groupId: process.env.GROUP_ID || undefined,
  freshInstalls: false, // more installs
} as const;

loadEnv(TEST_NAME);

// ============================================================
// Main Test Suite
// ============================================================

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let globalGroup: Group;

  // ============================================================
  // Test Lifecycle Setup
  // ============================================================

  setupTestLifecycle({
    expect,
  });

  // Add cleanup after all tests complete
  afterAll(async () => {
    try {
      console.log("Cleaning up workers...");
      if (workers) {
        await workers.terminateAll();
      }
      console.log("✓ Workers cleaned up successfully");
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

      console.log("Creating or getting new group");
      console.log("Worker inbox ids", testConfig.workerNames);

      const manualUsers = getManualUsers(["prod-testing"]);

      // Sync creator's conversations first
      console.log(`Syncing creator's ${creator.name} conversations`);
      await creator.client.conversations.syncAll();

      // Either create a new group or use existing one
      if (!testConfig.groupId) {
        console.log(
          `Creating group with ${testConfig.workerNames.length} members`,
        );
        globalGroup = (await creator.client.conversations.newGroup(
          [],
        )) as Group;
        await globalGroup.sync();
        console.log("Group id", globalGroup.id);
        const allInboxIds = [
          ...workers.getAllBut("bot").map((w) => w.client.inboxId),
          ...manualUsers.map((u) => u.inboxId),
        ];

        // Add members one by one
        for (const inboxId of allInboxIds) {
          try {
            await globalGroup.addMembers([inboxId]);
            await globalGroup.addSuperAdmin(inboxId);
            console.log(`Added member ${inboxId}`);
          } catch (e) {
            console.error(`Error adding member ${inboxId}:`, e);
          }
        }

        appendToEnv("GROUP_ID", globalGroup.id);
        console.log(`Created new group with ID: ${globalGroup.id}`);
      } else {
        globalGroup = (await creator.client.conversations.getConversationById(
          testConfig.groupId,
        )) as Group;
        await checkIfGroupForked(globalGroup);
      }

      // Sync conversations again after group operations
      await creator.client.conversations.syncAll();
      const conversations = await creator.client.conversations.list();
      console.log("Synced creator's conversations", conversations.length);
      await logAgentDetails(creator.client);
      return globalGroup;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it(`should verify fork-free message delivery`, async () => {
    try {
      const debugInfo = await globalGroup.debugInfo();
      // Send initial test message
      await globalGroup.send(`Starting stress test: ${testConfig.groupName}`);
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      await globalGroup.updateName(
        testConfig.groupName + ` epoch:${debugInfo.epoch}`,
      );
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      await verifyMessageStream(
        globalGroup,
        workers.getAllBut("bot"),
        1,
        `Verification from epoch ${debugInfo.epoch}: Hi ${workers
          .getAllBut("bot")
          .map((w) => w.name)
          .join(", ")}`,
      );
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      await verifyMembershipStream(
        globalGroup,
        workers.getAllBut("bot"),
        getRandomInboxIds(1),
      );
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      // Perform multiple cycles of membership changes
      await testMembershipChanges(workers, globalGroup.id);
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      await verifyMetadataStream(
        globalGroup,
        workers.getAllBut("bot"),
        1,
        testConfig.groupName,
      );
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
      await verifyMessageStream(
        globalGroup,
        workers.getAllBut("bot"),
        1,
        `Verification from epoch ${debugInfo.epoch}: Hi ${workers
          .getAllBut("bot")
          .map((w) => w.name)
          .join(", ")}`,
      );
      await checkEpochs(workers, globalGroup.id, debugInfo.epoch);
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
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

    await checkIfGroupForked(group);

    for (const member of getRandomInboxIds(5)) {
      try {
        await group.removeMembers([member]);
        await group.addMembers([member]);
        console.log(`Membership update: ${member}`);
        await group.sync();
      } catch (e) {
        console.error(`Error in membership cycle ${i}:`, e);
      }
    }
  }
}

export async function checkEpochs(
  workers: WorkerManager,
  groupId: string,
  creatorEpoch: bigint,
): Promise<void> {
  let result = [];
  for (const worker of workers.getAllBut("bot")) {
    const group = (await worker.client.conversations.getConversationById(
      groupId,
    )) as Group;
    const debugInfo = await group.debugInfo();
    result.push({
      name: worker.name,
      epoch: debugInfo.epoch,
      creatorEpoch,
    });
    if (debugInfo.epoch !== creatorEpoch) {
      throw new Error(
        `Epoch mismatch for ${worker.name}: ${debugInfo.epoch} !== ${creatorEpoch}`,
      );
    }
  }
  console.log(JSON.stringify(result, null, 2));
}
