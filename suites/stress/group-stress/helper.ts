import { logAgentDetails } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import { type Worker } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";

// ============================================================
// Metrics Tracking
// ============================================================

interface SyncMetrics {
  totalSyncs: number;
  syncErrors: number;
  messageCount: number;
}

const syncMetrics: Record<string, SyncMetrics> = {};

export function initializeMetrics(workerName: string): void {
  if (!syncMetrics[workerName]) {
    syncMetrics[workerName] = {
      totalSyncs: 0,
      syncErrors: 0,
      messageCount: 0,
    };
  }
}

export function incrementSyncCount(workerName: string): void {
  syncMetrics[workerName].totalSyncs++;
}

export function incrementErrorCount(workerName: string): void {
  if (syncMetrics[workerName]) {
    syncMetrics[workerName].syncErrors++;
  }
}

export async function updateMessageCount(worker: Worker): Promise<void> {
  const conversations = await worker.client.conversations.list();
  syncMetrics[worker.name].messageCount = (
    await Promise.all(conversations.map((c) => c.messages()))
  ).flat().length;
}

// ============================================================
// Worker Synchronization
// ============================================================

export async function syncWorker(
  worker: Worker,
  trackMetrics = true,
): Promise<void> {
  try {
    await worker.client.conversations.syncAll();

    if (trackMetrics) {
      if (!syncMetrics[worker.name]) {
        initializeMetrics(worker.name);
        await updateMessageCount(worker);
      }
      incrementSyncCount(worker.name);
    }
  } catch (e) {
    console.error(`Error syncing ${worker.name}:`, e);
    incrementErrorCount(worker.name);
  }
}

export async function syncAllWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((w) => syncWorker(w)));
}

// ============================================================
// Group Management
// ============================================================

export async function createOrGetNewGroup(
  creator: Worker,
  allClientIds: string[],
  groupId: string,
  testName: string,
): Promise<Group> {
  // Either create a new group or use existing one
  if (!groupId) {
    console.log(`Creating group with ${allClientIds.length} members`);
    const group = await creator.client.conversations.newGroup([]);
    await group.sync();

    // Add members one by one
    for (const member of allClientIds) {
      try {
        await group.addMembers([member]);
        await group.sync();
      } catch (e) {
        console.error(`Error adding member ${member}:`, e);
      }
    }

    // Set group name
    await group.updateName("Test group");
    appendToEnv("GROUP_ID", group.id, testName);
    return group;
  }

  // Sync creator's conversations
  await creator.client.conversations.syncAll();
  await logAgentDetails(creator.client);
  return (await creator.client.conversations.getConversationById(
    groupId,
  )) as Group;
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
        // Remove and add back the member
        await group.removeMembers([memberInboxId]);
        await group.sync();
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Removed and re-added ${member.name}`);
      } else {
        // Just add the member if not present
        await group.addMembers([memberInboxId]);
        await group.sync();
        console.log(`Cycle ${i}: Added missing member ${member.name}`);
      }
    } catch (e) {
      console.error(`Error in membership cycle ${i}:`, e);
    }
  }
}

export async function verifyGroupConsistency(
  groupId: string,
  workers: Worker[],
): Promise<Record<string, { members: number; messages: number }>> {
  const counts: Record<string, { members: number; messages: number }> = {};

  for (const worker of workers) {
    try {
      const group = (await worker.client.conversations.getConversationById(
        groupId,
      )) as Group;
      if (!group) continue;

      const members = await group.members();
      const messages = await group.messages();

      counts[worker.name] = {
        members: members.length,
        messages: messages.length,
      };
    } catch (e) {
      console.error(`Error verifying state for ${worker.name}:`, e);
    }
  }

  return counts;
}
