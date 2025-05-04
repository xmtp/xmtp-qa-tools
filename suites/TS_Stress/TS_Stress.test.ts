import { loadEnv } from "@helpers/client";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
  TEST_CONFIGS,
} from "@helpers/groups";
import { logError } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Client, Conversation } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "ts_stress";
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

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;
  let conversation: Conversation;
  beforeAll(async () => {
    try {
      let bot = await getWorkers(["bot"], testName, "message", "none");
      client = bot.get("bot")?.client as Client;
      conversation = await client.conversations.newDm(receiverInboxId);
      workers = await getWorkers(config.workerCount, testName);
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(config.workerCount);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });

  // Create a DM between two workers
  it("createAndSendDms: should create DMs and send messages", async () => {
    try {
      const dm = await createAndSendDms(
        workers,
        receiverInboxId,
        config.messageCount,
        conversation,
      );

      expect(dm).toBeTruthy();
    } catch (e) {
      logError(e, expect);
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
      logError(e, expect);
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
      logError(e, expect);
      throw e;
    }
  });
});
