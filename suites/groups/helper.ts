import { getRandomInboxIds } from "@helpers/utils";
import { type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";

export type TestFeature =
  | "verifyMessageStream"
  | "verifyMembershipStream"
  | "verifyMetadataStream"
  | "verifyEpochChange"
  | "addInstallationsRandomly"
  | "createGroup";

export interface GroupConfig {
  group: Group;
  features: TestFeature[];
  groupNumber: number;
}

export async function verifyEpochChange(
  workers: WorkerManager,
  groupId: string,
  epochs: number,
): Promise<void> {
  for (let i = 0; i < epochs; i++) {
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
