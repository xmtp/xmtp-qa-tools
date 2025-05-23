import { logAgentDetails } from "@helpers/client";
import { appendToEnv } from "@helpers/tests";
import { type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";

// ============================================================
// Group Management
// ============================================================

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
    appendToEnv("GROUP_ID", group.id, testName);
    return group;
  }

  // Sync creator's conversations
  console.log(`Syncing creator's ${creator.address} conversations`);
  await creator.client.conversations.sync();
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

export async function verifyGroupConsistency(
  globalGroup: Group,
  workers: WorkerManager,
): Promise<void> {
  const counts: Record<string, { members: number; messages: number }> = {};
  const creator = workers.get("bot");
  if (!creator) throw new Error("Creator not found");
  const allWorkers = workers.getAllButCreator();
  for (const worker of allWorkers) {
    try {
      const group = (await worker.client.conversations.getConversationById(
        globalGroup.id,
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
  const members = await globalGroup.members();
  const memberCount = members.length;
  const countsString = JSON.stringify(counts, null, 2);
  let icon = "✅";
  if (allWorkers.length !== Object.keys(counts).length) {
    icon = "❌";
  }
  const summary = `Group ${icon} consistency summary:\n\nMember count: ${memberCount}\nCreator: ${creator.name}\nTest workers: ${allWorkers.length} / ${Object.keys(counts).length}\nGroup ID: ${globalGroup.id}\nGroup consistency counts: ${countsString}`;
  await globalGroup.send(summary);
  console.debug(summary);
}
