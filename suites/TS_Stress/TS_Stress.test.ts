import { loadEnv } from "@helpers/client";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroups,
} from "@helpers/groups";
import { logError } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Client } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { TEST_CONFIGS } from "../../bots/stress";

const testName = "ts_stress";
loadEnv(testName);

const receiverInboxId =
  "ac9feb1384a9092333db4d17c6981743a53277c24c57ed6f12f05bd78a81be30";
// Choose which test size to run
const testSize = process.env.STRESS_SIZE || "small";
const config = TEST_CONFIGS[testSize];

console.log(`Running ${testSize} stress test with configuration:`, config);

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;

  beforeAll(async () => {
    try {
      let bot = await getWorkers(["bot"], testName, "message", "none");
      client = bot.get("bot")?.client as Client;
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
