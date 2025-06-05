import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  getFixedNames,
  getInboxIds,
  getManualUsers,
  sleep,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Client, Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { TEST_CONFIGS } from "../other/helper";

const testName = "bot-stress";
loadEnv(testName);

const receiverObj = getManualUsers(["fabri-convos-oneoff"])[0];
const receiverInboxId = receiverObj.inboxId;
// Choose which test size to run
const config = TEST_CONFIGS.medium;
const HELP_TEXT = `Starting:
- Send ${config.messageCount} DMs from each of ${config.workerCount} workers to you
- Create ${config.groupCount} groups with all workers
- Create ${config.largeGroups.join(", ")}-member large groups
- Send ${config.messageCount} messages to each group
`;
console.warn(HELP_TEXT);

describe(testName, () => {
  let workers: WorkerManager;
  let bot: Worker;

  setupTestLifecycle({
    expect,
  });
  beforeAll(async () => {
    try {
      workers = await getWorkers(
        [...getFixedNames(config.workerCount), "bot"],
        testName,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.None,
        receiverObj.network as "local" | "dev" | "production",
      );
      bot = workers.get("bot")!;
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Create DMs (groups of size 2)
  it("createAndSendDms: should create DMs and send messages", async () => {
    try {
      const result = await createGroupsWithSize(
        2,
        config.messageCount,
        workers,
        bot.client,
        receiverInboxId,
      );

      expect(result).toBeTruthy();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Create small groups
  it("createAndSendInGroup: should create a group and send messages", async () => {
    try {
      const result = await createGroupsWithSize(
        workers.getAllButCreator().length + 1, // groupSize (all workers + receiver)
        config.groupCount, // groupCount
        workers,
        bot.client,
        receiverInboxId,
      );

      expect(result).toBeTruthy();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Create large groups
  it("createLargeGroup: should create a large group with many members", async () => {
    try {
      // Create large groups for each size in config
      for (const size of config.largeGroups) {
        const result = await createGroupsWithSize(
          size, // groupSize
          1, // groupCount (one group per size)
          workers,
          bot.client,
          receiverInboxId,
        );
        expect(result).toBe(true);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});

export async function createGroupsWithSize(
  groupSize: number,
  groupCount: number,
  workers: WorkerManager,
  client: Client,
  receiverInboxId: string,
) {
  // Get all available worker inbox IDs
  const allWorkerInboxIds = workers
    .getAllButCreator()
    .map((w) => w.client.inboxId);

  // Always include receiver as a member
  const availableMembers = [receiverInboxId, ...allWorkerInboxIds];

  for (let i = 0; i < groupCount; i++) {
    try {
      const groupName = `Test Group ${i} (${groupSize} members): ${new Date().toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      )}`;

      // Select members for this group
      let groupMembers: string[] = [];

      if (groupSize <= availableMembers.length) {
        // Use subset of available members
        groupMembers = availableMembers.slice(0, groupSize);
      } else {
        // Need more members than available, so cycle through them
        for (let j = 0; j < groupSize; j++) {
          groupMembers.push(availableMembers[j % availableMembers.length]);
        }
        // Remove duplicates
        groupMembers = [...new Set(groupMembers)];

        // If we still need more members, get additional inbox IDs
        if (groupMembers.length < groupSize) {
          const additionalNeeded = groupSize - groupMembers.length;
          const additionalInboxIds = getInboxIds(additionalNeeded);
          groupMembers.push(...additionalInboxIds);
        }
      }

      // Create group with first member, then add the rest
      const initialMember = groupMembers[0];
      const remainingMembers = groupMembers.slice(1);

      const group = await client.conversations.newGroup([initialMember], {
        groupName,
        groupDescription: `Test group with ${groupSize} members`,
      });

      // Add remaining members in batches for large groups
      if (remainingMembers.length > 0) {
        const MAX_BATCH_SIZE = 10;

        for (let j = 0; j < remainingMembers.length; j += MAX_BATCH_SIZE) {
          const endIdx = Math.min(j + MAX_BATCH_SIZE, remainingMembers.length);
          const batchMembers = remainingMembers.slice(j, endIdx);

          try {
            await group.addMembers(batchMembers);
            await group.sync();

            // Add small delay for large batches
            if (batchMembers.length === MAX_BATCH_SIZE) {
              await sleep(500);
            }
          } catch (error) {
            console.error(
              `Error adding batch of members to group ${group.id}:`,
              error,
            );
          }
        }
      }

      // Send test message
      await group.send(`Hello from group ${i} with ${groupSize} members!`);
    } catch (error) {
      console.error(`Error creating group ${i}:`, error);

      throw error;
    }
  }

  return true;
}
