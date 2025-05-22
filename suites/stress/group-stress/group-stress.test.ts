import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getFixedNames } from "@helpers/tests";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import manualUsers from "../../../helpers/manualusers.json";
import {
  createOrGetNewGroup,
  syncAllWorkers,
  testMembershipChanges,
  verifyGroupConsistency,
} from "./helper";

// ============================================================
// Test Configuration
// ============================================================

const TEST_NAME = "group-stress";
const WORKER_NAMES = getFixedNames(14);

const testConfig = {
  testName: TEST_NAME,
  groupName: `Fork group ${new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`,
  epochs: 4,
  totalWorkers: 14,
  syncInterval: 10000,
  testWorkers: WORKER_NAMES.slice(1, 10), // Workers to test membership changes
  checkWorkers: WORKER_NAMES.slice(10, 14), // Workers to verify message delivery
  groupId: process.env.GROUP_ID,
} as const;

loadEnv(TEST_NAME);

// ============================================================
// Main Test Suite
// ============================================================

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let globalGroup: Group;
  let allWorkers: Worker[] = [];
  let allClientIds: string[] = [];
  let syncIntervalId: NodeJS.Timeout;
  let testStartTime: number;

  // ============================================================
  // Test Lifecycle Setup
  // ============================================================

  beforeAll(async () => {
    try {
      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bot", ...WORKER_NAMES],
        TEST_NAME,
        typeofStream.Message,
        typeOfResponse.Gm,
      );

      // Set creator as the first worker (more reliable than hardcoded name)
      const creatorName = WORKER_NAMES[0];
      creator = workers.get(creatorName) as Worker;

      if (!creator) {
        throw new Error(`Creator worker '${creatorName}' not found`);
      }

      // Get all manual user client IDs for the current environment
      allClientIds = manualUsers
        .filter(
          (user) =>
            user.app === "convos" && user.network === process.env.XMTP_ENV,
        )
        .map((user) => user.inboxId);

      // Create or get the global test group
      globalGroup = await createOrGetNewGroup(
        creator,
        allClientIds,
        testConfig.groupId || "",
        TEST_NAME,
      );

      if (!globalGroup?.id) {
        throw new Error("Failed to create or retrieve global group");
      }

      // Send initial test message
      await globalGroup.send(`Starting stress test: ${testConfig.groupName}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up periodic sync interval
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
      }

      // Send final test completion message
      if (globalGroup?.id) {
        await globalGroup.send(`Test completed: ${testConfig.groupName}`);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error during test cleanup:", errorMessage);
    }
  });

  // ============================================================
  // Test Cases
  // ============================================================

  it("should setup test environment", () => {
    try {
      testStartTime = performance.now();

      // Get all workers except the creator
      allWorkers = workers.getAllButCreator();

      if (allWorkers.length === 0) {
        throw new Error("No workers available for testing");
      }

      // Start periodic synchronization of all workers
      syncIntervalId = setInterval(
        () => void syncAllWorkers(allWorkers),
        testConfig.syncInterval,
      );

      console.log(`Test environment setup complete:
        - Creator: ${creator.name}
        - Test workers: ${allWorkers.length}
        - Group ID: ${globalGroup.id}
        - Sync interval: ${testConfig.syncInterval}ms`);
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should verify fork-free message delivery", async () => {
    try {
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      // Ensure all workers are synchronized
      await syncAllWorkers(allWorkers);

      // Get workers designated for checking message delivery
      const checkWorkers = allWorkers.filter((worker) =>
        testConfig.checkWorkers.includes(worker.name),
      );

      if (checkWorkers.length === 0) {
        throw new Error("No check workers available");
      }

      console.log(
        `Testing message delivery with ${checkWorkers.length} check workers`,
      );

      // Send test messages from each check worker
      for (const worker of checkWorkers) {
        await globalGroup.sync();
        const testMessage = `Message from ${worker.name} at ${Date.now()}`;
        await globalGroup.send(testMessage);
      }

      // Verify all workers receive the test message
      const verificationMessage = `Verification: Hi ${allWorkers.map((w) => w.name).join(", ")}`;
      await verifyMessageStream(
        globalGroup,
        allWorkers,
        1,
        verificationMessage,
      );

      console.log("✓ Fork-free message delivery verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should perform membership change cycles", async () => {
    try {
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      console.log(
        `Testing membership changes with ${testConfig.testWorkers.length} workers`,
      );

      // Test membership changes for each designated test worker
      for (const workerName of testConfig.testWorkers) {
        const worker = allWorkers.find((w) => w.name === workerName);

        if (!worker || worker.name === creator.name) {
          console.log(
            `Skipping worker: ${workerName} (not found or is creator)`,
          );
          continue;
        }

        console.log(`Testing membership changes for worker: ${worker.name}`);

        // Send a test message before membership changes
        const workerGroup =
          (await worker.client.conversations.getConversationById(
            globalGroup.id,
          )) as Group;

        if (workerGroup) {
          await workerGroup.send(`${worker.name}: pre-membership-test`);
        }

        // Perform multiple cycles of membership changes
        await testMembershipChanges(
          globalGroup.id,
          creator,
          worker,
          testConfig.epochs,
        );

        // Sync all workers after membership changes
        await syncAllWorkers(allWorkers);

        console.log(
          `✓ Completed ${testConfig.epochs} membership cycles for ${worker.name}`,
        );
      }
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });

  it("should verify final state consistency", async () => {
    try {
      if (!globalGroup?.id) {
        throw new Error("Global group is not initialized");
      }

      console.log("Verifying final state consistency...");

      // Send completion message
      await globalGroup.send(`${creator.name}: Test sequence completed`);

      // Final sync of all workers
      await syncAllWorkers(allWorkers);

      // Verify final message delivery across all workers
      await verifyMessageStream(
        globalGroup,
        allWorkers,
        1,
        "Final consistency check",
      );

      // Verify group state consistency across all workers
      const consistencyCounts = await verifyGroupConsistency(
        globalGroup.id,
        allWorkers,
      );

      // Log test results
      const testDuration = performance.now() - testStartTime;

      console.log("=== Test Results ===");
      console.log(`Test duration: ${Math.round(testDuration)}ms`);
      console.log("Group consistency counts:");
      console.log(JSON.stringify(consistencyCounts, null, 2));
      console.log("✓ Final state consistency verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });
});
