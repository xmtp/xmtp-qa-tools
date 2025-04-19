import { type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";

/**
 * Creates a group with specified participants and measures performance
 */
export async function createGroupWithBatch(
  creator: Worker,
  allWorkers: WorkerManager,
  batchSize: number,
  installationsPerUser: number,
): Promise<{
  groupId: string | undefined;
  memberCount: number;
  totalInstallations: number;
  executionTimeMs: number;
}> {
  const startTime = performance.now();
  const logLabel = `create group with ${batchSize} participants (${batchSize * installationsPerUser} installations)`;
  console.time(logLabel);

  const group = await creator.client?.conversations.newGroup(
    allWorkers
      .getWorkers()
      .map((w) => w.client.inboxId)
      .slice(0, batchSize),
  );

  const members = await group?.members();
  const totalInstallations = (members ?? []).reduce(
    (sum, m) => sum + (m?.installationIds.length ?? 0),
    0,
  );

  console.log(
    `Group created: ${group?.id} | Members: ${members?.length} | Installations: ${totalInstallations}`,
  );
  console.timeEnd(logLabel);

  return {
    groupId: group?.id,
    memberCount: members?.length ?? 0,
    totalInstallations,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Adds a member to a group
 */
export const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
): Promise<void> => {
  try {
    console.log(`${memberWhoAdds.name} will add/remove ${memberToAdd.name} `);
    await memberWhoAdds.client.conversations.syncAll();
    const foundGroup =
      (await memberWhoAdds.client.conversations.getConversationById(
        groupId,
      )) as Group;

    if (!foundGroup) {
      console.log(`Group ${groupId} not found`);
      return;
    }
    await foundGroup.sync();

    // Check if member exists before removing
    const members = await foundGroup.members();
    if (
      !members.some((member) => member.inboxId === memberToAdd.client.inboxId)
    ) {
      console.log(`${memberToAdd.name} is not a member of ${groupId}`);
    } else {
      console.log(`${memberToAdd.name} is a member of ${groupId}`);
    }

    // Check if member is an admin before removing admin role
    const admins = await foundGroup.admins;
    if (admins.includes(memberToAdd.client.inboxId)) {
      console.log(`Removing admin role from ${memberToAdd.name} in ${groupId}`);
      await foundGroup.removeAdmin(memberToAdd.client.inboxId);
    } else {
      console.log(`${memberToAdd.name} is not an admin in ${groupId}`);
    }
    //Check if memberWhoAdds is an admin before removing admin role
    if (admins.includes(memberWhoAdds.client.inboxId)) {
      console.log(
        `memberWhoAdds ${memberWhoAdds.name} is an admin in ${groupId}`,
      );
    } else {
      console.log(
        `memberWhoAdds ${memberWhoAdds.name} is not an admin in ${groupId}`,
      );
    }

    await foundGroup.sync();

    await foundGroup.removeMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();

    await foundGroup.addMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();
    await foundGroup.sync();

    await foundGroup.removeMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();

    await foundGroup.addMembers([memberToAdd.client.inboxId]);

    await foundGroup.sync();
  } catch (e) {
    console.error(
      `Error adding/removing ${memberToAdd.name} to ${groupId}:`,
      e,
    );
  }
};

/**
 * Sends a message from a worker with name and count
 */
export const sendMessageWithCount = async (
  worker: Worker,
  groupId: string,
  messageCount: number,
): Promise<number> => {
  try {
    // Random sync choice
    const syncChoice = Math.random() < 0.5;
    await worker.client.conversations[syncChoice ? "sync" : "syncAll"]();
    console.log(`${worker.name} performed ${syncChoice ? "sync" : "syncAll"}`);

    const group =
      await worker.client.conversations.getConversationById(groupId);
    const message = `${worker.name} ${messageCount}`;

    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await group?.send(message);
    return messageCount + 1;
  } catch (e) {
    console.error(`Error sending from ${worker.name}:`, e);
    return messageCount;
  }
};

/**
 * Gets workers that are members of a group
 */
export async function getWorkersFromGroup(
  group: Conversation,
  workers: WorkerManager,
): Promise<Worker[]> {
  await group.sync();
  const memberIds = (await group.members()).map((m) => m.inboxId);
  return workers
    .getWorkers()
    .filter((w) => memberIds.includes(w.client.inboxId));
}
