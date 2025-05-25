import { loadEnv, logAgentDetails } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  appendToEnv,
  getInboxIds,
  getManualUsers,
  getMultiVersion,
  removeDataFolder,
} from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

// ============================================================
// Test Configuration
// ============================================================

const TEST_NAME = "group-stress";
const WORKER_NAMES = getMultiVersion(14);
const testConfig = {
  testName: TEST_NAME,
  groupName: `NotForked ${getTime()}`,
  epochs: 4,
  network: "production",
  totalWorkers: 14,
  allWorkersNames: WORKER_NAMES,
  testWorkersNames: WORKER_NAMES.slice(1, WORKER_NAMES.length / 2),
  checkWorkersNames: WORKER_NAMES.slice(
    WORKER_NAMES.length / 2,
    WORKER_NAMES.length - 1,
  ), // Workers to verify message delivery
  groupId: process.env.GROUP_ID as string,
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
  let testWorkers: WorkerManager;
  let checkWorkers: WorkerManager;

  // ============================================================
  // Test Lifecycle Setup
  // ============================================================

  setupTestLifecycle({
    expect,
  });

  beforeAll(async () => {
    try {
      if (testConfig.freshInstalls) await removeDataFolder();

      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bot", ...WORKER_NAMES],
        testConfig.testName,
        typeofStream.Message,
        typeOfResponse.Gm,
        typeOfSync.Both,
        testConfig.network,
      );
      creator = workers.get("bot") as Worker;

      testWorkers = await getWorkers(
        testConfig.checkWorkersNames,
        testConfig.testName,
      );

      checkWorkers = await getWorkers(
        testConfig.checkWorkersNames,
        testConfig.testName,
        typeofStream.Message,
        typeOfResponse.Gm,
        typeOfSync.Both,
      );

      if (!creator || !testWorkers || !checkWorkers) {
        throw new Error(`Worker not found: ${creator?.name}`);
      }

      // Create or get the global test group
      globalGroup = await createOrGetNewGroup(
        creator,
        getManualUsers(["prod-testing"]).map((user) => user.inboxId),
        workers.getAllBut("bot").map((w) => w.client.inboxId),
        testConfig.groupId,
        testConfig.testName,
        testConfig.groupName,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it("should verify fork-free message delivery", async () => {
    try {
      await verifyMessageStream(
        globalGroup,
        checkWorkers.getAll(),
        1,
        `Verification: Hi ${checkWorkers
          .getAll()
          .map((w) => w.name)
          .join(", ")}`,
      );

      console.log("✓ Fork-free message delivery verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should verify fork-free membership delivery", async () => {
    try {
      await verifyMembershipStream(
        globalGroup,
        checkWorkers.getAll(),
        getInboxIds(1),
      );

      console.log("✓ Fork-free membership delivery verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should verify fork-free metadata delivery", async () => {
    try {
      await verifyMetadataStream(
        globalGroup,
        checkWorkers.getAll(),
        1,
        testConfig.groupName,
      );

      console.log("✓ Fork-free metadata delivery verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should perform membership change cycles", async () => {
    try {
      // Test membership changes for each designated test worker
      for (const worker of testWorkers.getAll()) {
        console.log(`Testing membership changes for worker: ${worker.name}`);

        // Perform multiple cycles of membership changes
        await testMembershipChanges(
          globalGroup.id,
          creator,
          worker,
          testConfig.epochs,
        );

        console.log(
          `✓ Completed ${testConfig.epochs} membership cycles for ${worker.name}`,
        );
      }
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should verify final state consistency", async () => {
    try {
      // Verify final message delivery across all workers
      await verifyMessageStream(
        globalGroup,
        checkWorkers.getAll(),
        1,
        `Verification: Hi ${checkWorkers
          .getAll()
          .map((w) => w.name)
          .join(", ")}`,
      );
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });
});

export async function createOrGetNewGroup(
  creator: Worker,
  workerInboxIds: string[],
  manualUserInboxIds: string[],
  groupId: string,
  testName: string,
  groupName: string,
): Promise<Group> {
  console.log("Creating or getting new group");
  console.log("Worker inbox ids", workerInboxIds);
  console.log("Manual user inbox ids", manualUserInboxIds);
  console.log("Group id", groupId);

  // Either create a new group or use existing one
  if (!groupId) {
    console.log(
      `Creating group with ${workerInboxIds.length + manualUserInboxIds.length} members`,
    );
    const group = await creator.client.conversations.newGroup([]);
    await group.sync();

    // Add members one by one
    for (const member of workerInboxIds) {
      try {
        await group.addMembers([member]);
      } catch (e) {
        console.error(`Error adding member ${member}:`, e);
      }
    }
    for (const member of manualUserInboxIds) {
      try {
        await group.addMembers([member]);
        await group.addAdmin(member);
      } catch (e) {
        console.error(`Error adding member ${member}:`, e);
      }
    }
    appendToEnv("GROUP_ID", group.id);
    return group;
  }

  // Sync creator's conversations
  console.log(`Syncing creator's ${creator.name} conversations`);
  await creator.client.conversations.syncAll();
  const conversations = await creator.client.conversations.list();
  if (conversations.length === 0) throw new Error("No conversations found");
  console.log("Synced creator's conversations", conversations.length);
  await logAgentDetails(creator.client);

  const globalGroup = (await creator.client.conversations.getConversationById(
    groupId,
  )) as Group;
  if (!globalGroup) throw new Error("Group not found");

  // Send initial test message
  await globalGroup.send(`Starting stress test: ${groupName}`);
  await globalGroup.updateName(groupName);
  return globalGroup;
}

export async function testMembershipChanges(
  groupId: string,
  admin: Worker,
  member: Worker,
  cycles: number,
): Promise<void> {
  console.log(`Testing membership changes: ${admin.name} with ${member.name}`);

  const group = (await admin.client.conversations.getConversationById(
    groupId,
  )) as Group;
  if (!group) throw new Error(`Group ${groupId} not found`);

  const memberInboxId = member.client.inboxId;

  for (let i = 0; i <= cycles; i++) {
    try {
      // Get current members to check if target exists
      const members = await group.members();
      const memberExists = members.some(
        (m) => m.inboxId.toLowerCase() === memberInboxId.toLowerCase(),
      );

      if (memberExists) {
        await group.removeMembers([memberInboxId]);
        await group.addMembers([memberInboxId]);
        console.log(`Cycle ${i}: Removed and re-added ${member.name}`);
      } else {
        // Just add the member if not present
        await group.addMembers([memberInboxId]);
        console.log(`Cycle ${i}: Added missing member ${member.name}`);
      }
      await group.sync();
    } catch (e) {
      console.error(`Error in membership cycle ${i}:`, e);
    }
  }
}
