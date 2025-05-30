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
  sleep,
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
  totalTests: 20,
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

  for (let i = 0; i < testConfig.totalTests; i++) {
    it(`should verify fork-free message delivery ${i}`, async () => {
      try {
        await sleep(600); // wait 600 seconds between tests ( 10 minutes  )
        const debugInfo = await globalGroup.debugInfo();
        // Send initial test message
        await globalGroup.send(`Starting stress test: ${testConfig.groupName}`);
        await globalGroup.updateName(
          testConfig.groupName + `-${i}:${debugInfo.epoch}`,
        );
        await verifyMessageStream(
          globalGroup,
          workers.getAllBut("bot"),
          1,
          `Verification from epoch ${debugInfo.epoch}: Hi ${workers
            .getAllBut("bot")
            .map((w) => w.name)
            .join(", ")}`,
        );
        await verifyMembershipStream(
          globalGroup,
          workers.getAllBut("bot"),
          getRandomInboxIds(1),
        );
        // Perform multiple cycles of membership changes
        await testMembershipChanges(
          workers,
          getRandomInboxIds(1),
          globalGroup.id,
        );
        await verifyMetadataStream(
          globalGroup,
          workers.getAllBut("bot"),
          1,
          testConfig.groupName,
        );
        await verifyMessageStream(
          globalGroup,
          workers.getAllBut("bot"),
          1,
          `Verification from epoch ${debugInfo.epoch}: Hi ${workers
            .getAllBut("bot")
            .map((w) => w.name)
            .join(", ")}`,
        );
      } catch (error: unknown) {
        logError(error, expect.getState().currentTestName);
        throw error;
      }
    });
  }
});

export async function testMembershipChanges(
  workers: WorkerManager,
  members: string[],
  groupId: string,
): Promise<void> {
  const cantAdmins = 4;
  const cantCylcesPerAdmin = testConfig.epochs;
  for (const admin of workers.getAllBut("bot").slice(0, cantAdmins)) {
    const group = (await admin.client.conversations.getConversationById(
      groupId,
    )) as Group;
    await checkIfGroupForked(group);

    const memberInboxId = members[0];

    for (let i = 0; i <= cantCylcesPerAdmin; i++) {
      try {
        // Get current members to check if target exists
        const members = await group.members();
        const memberExists = members.some(
          (m) => m.inboxId.toLowerCase() === memberInboxId.toLowerCase(),
        );

        if (memberExists) await group.removeMembers([memberInboxId]);
        await group.addMembers([memberInboxId]);
        console.log(`Cycle ${i}: Membership update: ${admin.name}`);
        await group.sync();
      } catch (e) {
        console.error(`Error in membership cycle ${i}:`, e);
      }
    }
  }
}
