import { loadEnv } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import {
  getManualUsers,
  getMultiVersion,
  removeDataFolder,
} from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createOrGetNewGroup,
  testMembershipChanges,
  verifyGroupConsistency,
} from "./helper";

// ============================================================
// Test Configuration
// ============================================================

const TEST_NAME = "group-stress";
const WORKER_NAMES = getMultiVersion(14);
const testConfig = {
  testName: TEST_NAME,
  groupName: `NotForked ${getTime()}`,
  epochs: 3,
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  network: "production",
  totalWorkers: 14,
  allWorkersNames: WORKER_NAMES,
  testWorkersNames: WORKER_NAMES.slice(1, 10), // Workers to test membership changes
  checkWorkersNames: WORKER_NAMES.slice(10, 14), // Workers to verify message delivery
  groupId: process.env.GROUP_ID as string,
  freshInstalls: true, // more installs
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
  let testStartTime: number;

  // ============================================================
  // Test Lifecycle Setup
  // ============================================================

  setupTestLifecycle({
    expect,
  });

  beforeAll(async () => {
    try {
      if (testConfig.freshInstalls) await removeDataFolder();

      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bot", ...WORKER_NAMES],
        testConfig.testName,
        testConfig.typeofStream,
        testConfig.typeOfResponse,
        testConfig.typeOfSync,
        testConfig.network,
      );

      creator = workers.get("bot") as Worker;
      allWorkers = workers.getAllBut("bot");
      if (!creator) {
        throw new Error(`Creator worker 'bot' not found`);
      }

      // Create or get the global test group
      globalGroup = await createOrGetNewGroup(
        creator,
        getManualUsers(["prod-testing"]).map((user) => user.inboxId),
        workers.getAllBut("bot").map((w) => w.client.inboxId),
        testConfig.groupId,
        testConfig.testName,
        testConfig.groupName,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  // ============================================================
  // Test Cases
  // ============================================================

  it("should setup test environment", async () => {
    try {
      testStartTime = performance.now();

      await verifyGroupConsistency(globalGroup, workers);
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

      // Get workers designated for checking message delivery
      const checkWorkers = allWorkers.filter((worker) =>
        testConfig.checkWorkersNames.includes(worker.name),
      );

      if (checkWorkers.length === 0) {
        console.log(testConfig.checkWorkersNames);
        throw new Error("No check workers available");
      }

      console.log(
        `Testing message delivery with ${checkWorkers.length} check workers`,
      );

      // Send test messages from each check worker
      for (const worker of checkWorkers) {
        await globalGroup.sync();
        const testMessage = `Message from ${worker.name} at ${getTime()}`;
        await globalGroup.send(testMessage);
      }

      // Verify all workers refceive the test message
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
        `Testing membership changes with ${testConfig.testWorkersNames.length} workers`,
      );

      // Test membership changes for each designated test worker
      for (const workerName of testConfig.testWorkersNames) {
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
          await workerGroup.send(`${worker.name}: sup`);
        }

        // Perform multiple cycles of membership changes
        await testMembershipChanges(
          globalGroup.id,
          creator,
          worker,
          testConfig.epochs,
        );

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

      // Verify final message delivery across all workers
      await verifyMessageStream(
        globalGroup,
        allWorkers,
        1,
        "Final consistency check",
      );

      await verifyGroupConsistency(globalGroup, workers);

      // Log test results
      const testDuration = performance.now() - testStartTime;

      console.log("=== Test Results ===");
      console.log(`Test duration: ${Math.round(testDuration)}ms`);
      console.log("✓ Final state consistency verified");
    } catch (error: unknown) {
      logError(error, expect.getState().currentTestName);
      throw error;
    }
  });
});
