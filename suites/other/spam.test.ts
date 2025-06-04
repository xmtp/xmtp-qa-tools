import { getWorkers, type WorkerManager } from "@workers/manager";
import { loadEnv } from "dev/helpers/client";
import { logError } from "dev/helpers/logger";
import {
  formatBytes,
  getManualUsers,
  getRandomInboxIds,
} from "dev/helpers/utils";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { describe, expect, it } from "vitest";

const testName = "spam";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  setupTestLifecycle({ expect });

  it("should create 3-person groups until reaching 100MB database", async () => {
    try {
      const suffix = Math.random().toString(36).substring(2, 15);
      workers = await getWorkers(["random" + suffix], testName);
      const creator = workers.get("random" + suffix);
      const memberInboxIds = getManualUsers(["fabri-tba"]).map(
        (user) => user.inboxId,
      );
      let currentTotalSize = creator?.worker.getSQLiteFileSizes().walFile ?? 0;
      let conversations = await creator?.client.conversations.list();
      const targetSizeBytes = 100 * 1024 * 1024;
      while (currentTotalSize < targetSizeBytes) {
        await creator?.client.conversations.newGroup(memberInboxIds);

        const currentSizes = creator?.worker.getSQLiteFileSizes();
        conversations = await creator?.client.conversations.list();
        currentTotalSize =
          (currentSizes?.walFile ?? 0) + (currentSizes?.dbFile ?? 0);
        if (currentTotalSize > targetSizeBytes) {
          break;
        }

        console.log(
          `Size: ${formatBytes(currentTotalSize)} | Conversations: ${conversations?.length}`,
        );
      }
      console.log(
        `\n🎯 Reached ${formatBytes(currentTotalSize)} with ${conversations?.length} groups of ${memberCount} members each.`,
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
