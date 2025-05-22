import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { appendToEnv, getFixedNames } from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// ============================================================
// Configuration
// ============================================================

const TEST_NAME = "ts_fork";
loadEnv(TEST_NAME);

const names = getFixedNames(14);

const testConfig = {
  testName: TEST_NAME,
  groupName: `Fork group ${new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`,
  epochs: 12,
  syncInterval: 10000,
  testWorkers: names.slice(1, 10),
  checkWorkers: names.slice(10, 14),
  groupId: process.env.GROUP_ID,
  manualUsers: {
    USER_CONVOS:
      "83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208",
    USER_CONVOS_DESKTOP:
      "3a54da678a547ea3012b55734d22eb5682c74da1747a31f907d36afe20e5b8f9",
    USER_CB_WALLET:
      "7ba6992b03fc8a177b9665c1a04d498dccec65ce40d85f7b1f01160a0eb7dc7d",
    USER_XMTPCHAT:
      "e7950aec8714e774f63d74bed69b75b88593c5f6a477e61128afd92b98f11293",
  },
};

// ============================================================
// Metrics Tracking
// ============================================================

interface SyncMetrics {
  totalSyncs: number;
  syncErrors: number;
  messageCount: number;
}

const syncMetrics: Record<string, SyncMetrics> = {};

function initializeMetrics(workerName: string): void {
  if (!syncMetrics[workerName]) {
    syncMetrics[workerName] = {
      totalSyncs: 0,
      syncErrors: 0,
      messageCount: 0,
    };
  }
}

function incrementSyncCount(workerName: string): void {
  syncMetrics[workerName].totalSyncs++;
}

function incrementErrorCount(workerName: string): void {
  if (syncMetrics[workerName]) {
    syncMetrics[workerName].syncErrors++;
  }
}

async function updateMessageCount(worker: Worker): Promise<void> {
  const conversations = await worker.client.conversations.list();
  syncMetrics[worker.name].messageCount = (
    await Promise.all(conversations.map((c) => c.messages()))
  ).flat().length;
}

// ============================================================
// Worker Synchronization
// ============================================================

async function syncWorker(worker: Worker, trackMetrics = true): Promise<void> {
  try {
    await worker.client.conversations.syncAll();

    if (trackMetrics && !syncMetrics[worker.name]) {
      const conversations = await worker.client.conversations.list();
      syncMetrics[worker.name] = {
        totalSyncs: 1,
        syncErrors: 0,
        messageCount: (
          await Promise.all(conversations.map((c) => c.messages()))
        ).flat().length,
      };
    } else if (trackMetrics) {
      syncMetrics[worker.name].totalSyncs++;
    }
  } catch (e) {
    console.error(`Error syncing ${worker.name}:`, e);
    if (syncMetrics[worker.name]) syncMetrics[worker.name].syncErrors++;
  }
}

async function syncAllWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((w) => syncWorker(w)));
}

// ============================================================
// Group Management
// ============================================================

async function initializeGroup(
  creator: Worker,
  clientIds: string[],
): Promise<Group> {
  // Use existing group if available
  if (testConfig.groupId) {
    console.log(`Using existing group ${testConfig.groupId}`);
    return (await creator.client.conversations.getConversationById(
      testConfig.groupId,
    )) as Group;
  }

  // Create new group
  console.log(`Creating group with ${clientIds.length} members`);
  const group = await creator.client.conversations.newGroup([]);
  await group.sync();

  // Add members
  for (const member of clientIds) {
    try {
      await group.addMembers([member]);
      await group.sync();

      // Add super admin privileges to manual users
      if (Object.values(testConfig.manualUsers).includes(member)) {
        const key = Object.keys(testConfig.manualUsers).find(
          (k) =>
            testConfig.manualUsers[k as keyof typeof testConfig.manualUsers] ===
            member,
        );
        if (key) await group.addSuperAdmin(member);
      }
    } catch (e) {
      console.error(`Error adding member ${member}:`, e);
    }
  }

  await group.updateName(testConfig.groupName);
  appendToEnv("GROUP_ID", group.id, testConfig.testName);
  return group;
}

async function testMembershipChanges(
  group: Group,
  member: Worker,
  cycles: number,
): Promise<void> {
  const memberInboxId = member.client.inboxId;
  console.log(`Testing membership changes with ${member.name}`);

  for (let i = 0; i <= cycles; i++) {
    try {
      const members = await group.members();
      const memberExists = members.some(
        (m) => m.inboxId.toLowerCase() === memberInboxId.toLowerCase(),
      );

      if (memberExists) {
        await group.removeMembers([memberInboxId]);
        await group.sync();
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Removed and re-added ${member.name}`);
      } else {
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Added missing member ${member.name}`);
      }
    } catch (e) {
      console.error(`Error in membership cycle ${i}:`, e);
    }
  }
}

// ============================================================
// Test Suite
// ============================================================

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let start: number;
  let creator: Worker;
  let globalGroup: Group;
  let allWorkers: Worker[] = [];
  let syncIntervalId: NodeJS.Timeout;

  // Setup test environment
  it("setup environment and group", async () => {
    start = performance.now();

    // Initialize workers
    workers = await getWorkers(
      ["bot", ...names],
      TEST_NAME,
      typeofStream.Message,
      typeOfResponse.Gm,
    );

    creator = workers.get("fabri") as Worker;
    await creator.client.conversations.syncAll();

    allWorkers = workers.getAllButCreator();
    const allClientIds = [
      ...allWorkers.map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers),
    ];

    // Set up periodic sync
    syncIntervalId = setInterval(
      () => void Promise.all(allWorkers.map((w) => syncWorker(w))),
      testConfig.syncInterval,
    );

    // Initialize group
    await syncWorker(creator, false);
    globalGroup = await initializeGroup(creator, allClientIds);
    await globalGroup.send(`Starting run: ${testConfig.groupName}`);
  });

  // Test fork check with message delivery
  it("verify message delivery", async () => {
    await Promise.all(allWorkers.map((w) => syncWorker(w)));

    // Send messages from check workers
    const checkWorkers = allWorkers.filter((w) =>
      testConfig.checkWorkers.includes(w.name),
    );
    for (const worker of checkWorkers) {
      await globalGroup.sync();
      await globalGroup.send(`hey ${worker.name}`);
    }

    // Verify message delivery
    await verifyMessageStream(
      globalGroup,
      allWorkers,
      1,
      `Hi ${allWorkers.map((w) => w.name).join(", ")}`,
    );
  });

  // Test membership changes
  it("test membership changes", async () => {
    for (const workerName of testConfig.testWorkers) {
      const worker = allWorkers.find((w) => w.name === workerName);
      if (!worker || worker.name === creator.name) continue;

      // Send test message
      const workerGroup =
        (await worker.client.conversations.getConversationById(
          globalGroup.id,
        )) as Group;
      if (workerGroup) await workerGroup.send(`${worker.name}:test`);

      // Test membership changes
      await testMembershipChanges(globalGroup, worker, testConfig.epochs);
      await Promise.all(allWorkers.map((w) => syncWorker(w)));
    }
  });

  // Finish test and verify consistency
  it("verify final consistency", async () => {
    await globalGroup.send(`${creator.name} : Done`);
    await Promise.all(allWorkers.map((w) => syncWorker(w)));

    await verifyMessageStream(globalGroup, allWorkers, 1, "Final check");
    clearInterval(syncIntervalId);

    // Check consistency
    const memberCounts: Record<string, number> = {};
    const messageCounts: Record<string, number> = {};

    await Promise.all(
      allWorkers.map(async (worker) => {
        try {
          const group = (await worker.client.conversations.getConversationById(
            globalGroup.id,
          )) as Group;
          if (!group) return;

          memberCounts[worker.name] = (await group.members()).length;
          messageCounts[worker.name] = (await group.messages()).length;
        } catch (e) {
          console.error(`Error verifying state for ${worker.name}:`, e);
        }
      }),
    );

    console.debug(JSON.stringify({ memberCounts, messageCounts }, null, 2));
    console.log(`Test duration: ${performance.now() - start}ms`);
  });
});
