import { logAgentDetails } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import { type Worker } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";

// ============================================================
// Worker Synchronization
// ============================================================

export async function syncAllWorkers(workers: Worker[]): Promise<void> {
  for (const worker of workers) {
    await worker.client.conversations.syncAll();
  }
}

// ============================================================
// Group Management
// ============================================================

export async function createOrGetNewGroup(
  creator: Worker,
  workerInboxIds: string[],
  manualUserInboxIds: string[],
  groupId: string,
  testName: string,
): Promise<Group> {
  console.log("Creating or getting new group");
  console.log("Worker inbox ids", workerInboxIds);
  console.log("Manual user inbox ids", manualUserInboxIds);
  console.log("Group id", groupId);
  console.log("Test name", testName);

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
    appendToEnv("GROUP_ID", group.id, testName);
    return group;
  }

  // Sync creator's conversations
  console.log("Syncing creator's conversations");
  await creator.client.conversations.syncAll();
  const conversations = await creator.client.conversations.list();
  console.log("Synced creator's conversations", conversations.length);
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
