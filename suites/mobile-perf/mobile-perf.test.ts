import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  getFixedNames,
  getInboxIds,
  getManualUsers,
  sleep,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Client, Dm, Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createAndSendDms,
  TEST_CONFIGS,
  type StressTestConfig,
} from "../other/helper";

const testName = "bot-stress";
loadEnv(testName);

const receiverInboxId = getManualUsers(["convos-prod"])[0].inboxId;
// Choose which test size to run
const testSize = process.env.STRESS_SIZE || "small";
const config = TEST_CONFIGS[testSize];

console.log(
  `Running ${testSize} stress test with configuration:`,
  JSON.stringify(config, null, 2),
);

describe(testName, async () => {
  let workers: WorkerManager;
  workers = await getWorkers(["bot"], testName);
  let bot: Worker;
  let client: Client;
  let conversation: Dm;

  beforeAll(async () => {
    try {
      bot = workers.get("bot")!;
      client = bot.client;
      conversation = (await client.conversations.newDm(receiverInboxId)) as Dm;
      workers = await getWorkers(getFixedNames(config.workerCount), testName);
      expect(workers).toBeDefined();
      expect(workers.getAll().length).toBe(config.workerCount);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  setupTestLifecycle({
    expect,
  });
  // Create a DM between two workers
  it("createAndSendDms: should create DMs and send messages", async () => {
    try {
      const dm = await createAndSendDms(
        workers,
        receiverInboxId,
        config.messageCount,
      );

      expect(dm).toBeTruthy();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Create a small group with worker members
  it("createAndSendInGroup: should create a group and send messages", async () => {
    try {
      const group = await createAndSendInGroup(
        workers,
        client,
        config.groupCount,
        receiverInboxId,
        conversation,
      );

      expect(group).toBeTruthy();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // // Create a large group
  it("createLargeGroup: should create a large group with many members", async () => {
    try {
      // Create large groups
      const result = await createLargeGroups(
        config,
        workers,
        client,
        receiverInboxId,
      );
      expect(result).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});

export async function createAndSendInGroup(
  workers: WorkerManager,
  client: Client,
  groupCount: number,
  receiverInboxId: string,
  conversation: Dm,
) {
  const allInboxIds = workers.getAllButCreator().map((w) => w.client.inboxId);
  allInboxIds.push(receiverInboxId);

  for (let i = 0; i < groupCount; i++) {
    try {
      const groupName = `Test Group ${i} ${allInboxIds.length}: ${new Date().toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      )}`;
      const group = await client.conversations.newGroup([], {
        groupName,
        groupDescription: "Test group for stress testing",
      });
      for (const inboxId of allInboxIds) {
        try {
          await group.addMembers([inboxId]);
        } catch (error) {
          console.error(
            `Error adding member ${inboxId} to group ${group.id}:`,
            error,
          );
        }
      }
      await group.sync();
      await group.send(`Hello from the group! ${i}`);
      await conversation.send(
        `✅ Successfully created group ${groupName} with ${allInboxIds.length} members`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  return true;
}

export async function createLargeGroup(
  client: Client,
  memberCount: number,
  receiverInboxId: string,
): Promise<Group> {
  try {
    const MAX_BATCH_SIZE = 10;
    const initialMembers = getInboxIds(1);

    initialMembers.push(receiverInboxId);

    const groupName = `Large Group ${memberCount}: ${initialMembers.length}`;
    const group = await client.conversations.newGroup(initialMembers, {
      groupName,
      groupDescription: `Test group with ${memberCount} members`,
    });

    await group.sync();

    for (let i = 1; i < memberCount; i += MAX_BATCH_SIZE) {
      const endIdx = Math.min(i + MAX_BATCH_SIZE, memberCount);
      const batchMembers = getInboxIds(endIdx - i);

      if (batchMembers.length > 0) {
        await group.addMembers(batchMembers);
        await group.sync();
        await sleep(500);
      }
    }

    await group.send(`Hello from the group with ${memberCount} members`);
    return group as Group;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function createLargeGroups(
  config: StressTestConfig,
  workers: WorkerManager,
  client: Client,
  receiverInboxId: string,
  conversation?: Dm,
) {
  for (const size of config.largeGroups) {
    try {
      if (conversation) {
        await conversation.send(`Creating group with ${size} members...`);
      }

      const group = await createLargeGroup(client, size, receiverInboxId);

      if (!group) {
        if (conversation) {
          await conversation.send(
            `❌ Failed to create group with ${size} members`,
          );
        }
        continue;
      }

      if (conversation) {
        await conversation.send(
          `✅ Successfully created group with ${size} members (ID: ${group.id})`,
        );
        await conversation.send(`📨 Sending messages to group ${group.id}...`);
      }
    } catch (error) {
      if (conversation) {
        await conversation.send(
          `❌ Error creating group with ${size} members: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return true;
}
