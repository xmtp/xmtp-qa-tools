import { loadEnv } from "@helpers/client";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  TEST_CONFIGS,
} from "@helpers/groups";
import { logError } from "@helpers/logger";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Client, Conversation } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bot-stress";
loadEnv(testName);

const receiverInboxId =
  "5dd3e3f8cd0feec31d56015629d8ad04f93979c4aa4c55af831c5bfd2afc440f";
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
  let conversation: Conversation;

  beforeAll(async () => {
    try {
      bot = workers.get("bot")!;
      client = bot.client;
      conversation = await client.conversations.newDm(receiverInboxId);
      workers = await getWorkers(getRandomNames(config.workerCount), testName);
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
