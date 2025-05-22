import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getFixedNames } from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import manualUsers from "../../../helpers/manualusers.json";
import {
  createOrGetNewGroup,
  syncAllWorkers,
  testMembershipChanges,
  verifyGroupConsistency,
} from "./helper";

const TEST_NAME = "ts_fork";
const names = getFixedNames(14);
const testConfig = {
  testName: TEST_NAME,
  groupName: `Fork group ${new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`,
  epochs: 4,
  workers: 14,
  syncInterval: 10000,
  testWorkers: names.slice(1, 10),
  checkWorkers: names.slice(10, 14),
  groupId: process.env.GROUP_ID,
};
// ============================================================
// Configuration
// ============================================================

loadEnv(TEST_NAME);

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let start: number;
  let creator: Worker;
  let globalGroup: Group;
  let allClientIds: string[] = [];
  let allWorkers: Worker[] = [];
  let syncIntervalId: NodeJS.Timeout;

  // Check for GROUP_ID before running any tests
  beforeAll(async () => {
    // Initialize workers
    workers = await getWorkers(
      ["bot", ...names],
      TEST_NAME,
      typeofStream.Message,
      typeOfResponse.Gm,
    );
    creator = workers.get("fabri") as Worker;
    await creator.client.conversations.syncAll();

    globalGroup = await createOrGetNewGroup(
      creator,
      allClientIds,
      testConfig.groupId || "",
      TEST_NAME,
    );
    if (!globalGroup.id) {
      throw new Error("Global group ID is not set");
    }
    await globalGroup.send(`Starting run: ${testConfig.groupName}`);
  });

  // Setup test environment
  it("setup test environment", () => {
    try {
      start = performance.now();

      allWorkers = workers.getAllButCreator();
      allClientIds = manualUsers
        .filter(
          (user) =>
            user.app === "convos" && user.network === process.env.XMTP_ENV,
        )
        .map((user) => user.inboxId);

      // Start periodic sync
      syncIntervalId = setInterval(
        () => void syncAllWorkers(allWorkers),
        testConfig.syncInterval,
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Test fork check with message delivery
  it("verify fork-free message delivery", async () => {
    try {
      // Skip if globalGroup is undefined
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      await syncAllWorkers(allWorkers);

      // Send messages from check workers
      const checkWorkers = allWorkers.filter((w) =>
        testConfig.checkWorkers.includes(w.name),
      );

      for (const worker of checkWorkers) {
        await globalGroup.sync();
        await globalGroup.send(`hey ${worker.name}`);
      }

      // Verify message delivery
      await verifyMessageStream(
        globalGroup,
        allWorkers,
        1,
        `Hi ${allWorkers.map((w) => w.name).join(", ")}`,
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Test membership changes
  it("perform membership change cycles", async () => {
    try {
      // Skip if globalGroup is undefined
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      for (const workerName of testConfig.testWorkers) {
        const worker = allWorkers.find((w) => w.name === workerName);
        if (!worker || worker.name === creator.name) continue;

        // Send a test message
        const group = (await worker.client.conversations.getConversationById(
          globalGroup.id,
        )) as Group;

        if (group) await group.send(`${worker.name}:test`);

        // Perform membership change cycles
        await testMembershipChanges(
          globalGroup.id,
          creator,
          worker,
          testConfig.epochs,
        );

        await syncAllWorkers(allWorkers);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Finish test and verify consistency
  it("verify final state consistency", async () => {
    try {
      // Skip if globalGroup is undefined
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      // Send final messages
      await globalGroup.send(`${creator.name} : Done`);
      await syncAllWorkers(allWorkers);

      // Verify final message delivery
      await verifyMessageStream(globalGroup, allWorkers, 1, "Final check");
      clearInterval(syncIntervalId);

      // Verify consistent state across all workers
      const counts = await verifyGroupConsistency(globalGroup.id, allWorkers);

      console.debug(JSON.stringify(counts, null, 2));
      console.log(`Test duration: ${performance.now() - start}ms`);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
