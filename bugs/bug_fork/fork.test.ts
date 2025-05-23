import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { getManualUsers } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { createOrGetNewGroup } from "suites/stress/group-stress/helper";
import { beforeAll, describe, expect } from "vitest";

const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  groupName: `NotForked ${getTime()}`,
  epochs: 3,
  typeofStream: typeofStream.Message,
  typeOfResponse: typeOfResponse.Gm,
  typeOfSync: typeOfSync.Both,
  network: "production",
  totalWorkers: 5,
  testWorkers: ["bob", "alice", "dave", "charlie"],
} as const;

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let allWorkers: Worker[];
  let globalGroup: Group;

  setupTestLifecycle({
    expect,
  });

  beforeAll(async () => {
    try {
      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bot", ...testConfig.testWorkers],
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
        getManualUsers(["fabri"]).map((user) => user.inboxId),
        allWorkers.map((w) => w.client.inboxId),
        process.env.GROUP_ID as string,
        TEST_NAME,
      );

      if (!globalGroup?.id) {
        throw new Error("Failed to create or retrieve global group");
      }

      // Send initial test message
      await globalGroup.send(
        `Starting stress test: ${testConfig.groupName} frpm ${process.env.CURRENT_ENV_PATH}]`,
      );
      await globalGroup.updateName(testConfig.groupName);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });
});
