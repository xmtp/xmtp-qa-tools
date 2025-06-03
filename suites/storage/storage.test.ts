import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  formatBytes,
  getInboxIds,
  getRandomInboxIds,
  sleep,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "storage";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  setupTestLifecycle({ expect });

  // Helper function to get actual final DB size by forcing a checkpoint
  const getFinalDbSize = async (worker: any) => {
    // Force SQLite to checkpoint by restarting the client
    const originalName = worker.name;
    await worker.worker.terminate();
    await sleep(1000); // Give SQLite time to clean up

    // Reinitialize to get a fresh connection
    await worker.worker.initialize();
    await sleep(500); // Small delay for initialization

    // Now measure the actual sizes after checkpoint
    return worker.worker.getSQLiteFileSizes();
  };

  it("should create groups with different member counts", async () => {
    try {
      let groups: {
        memberCount: number;
        sizes: { dbFile: number; walFile: number; shmFile: number };
        finalSizes: { dbFile: number; walFile: number; shmFile: number };
        conversationCount: number;
      }[] = [];
      const suffix = Math.random().toString(36).substring(2, 15);
      workers = await getWorkers(["random" + suffix], testName);
      const creator = workers.get("random" + suffix);

      if (!creator) {
        throw new Error("Creator worker not found");
      }

      // Initial measurement
      const initialSizes = creator.worker.getSQLiteFileSizes();
      await creator.client.conversations.sync();
      const initialConversations = await creator.client.conversations.list();
      const initialFinalSizes = await getFinalDbSize(creator);

      groups.push({
        memberCount: 0,
        sizes: initialSizes,
        finalSizes: initialFinalSizes,
        conversationCount: initialConversations.length,
      });
      console.log(
        `Initial state: ${initialConversations.length} conversations, WAL: ${formatBytes(initialSizes.walFile)}`,
      );

      const memberCounts = [2, 50, 100, 150, 200];

      for (const memberCount of memberCounts) {
        console.log(`Creating group with ${memberCount} members...`);

        const memberInboxIds = getRandomInboxIds(memberCount);
        const group =
          await creator.client.conversations.newGroup(memberInboxIds);
        console.log(`✓ Group created with ID: ${group.id}`);

        await creator.client.conversations.sync();

        // Measure before potential checkpointing
        const preSizes = creator.worker.getSQLiteFileSizes();
        console.log(`Pre-checkpoint WAL: ${formatBytes(preSizes.walFile)}`);

        await sleep(100);

        // Measure after sleep
        const postSizes = creator.worker.getSQLiteFileSizes();
        const conversations = await creator.client.conversations.list();

        // Get actual final size after forced checkpoint
        console.log("Forcing database checkpoint...");
        const finalSizes = await getFinalDbSize(creator);

        console.log(
          `Post-sleep WAL: ${formatBytes(postSizes.walFile)}, Final DB: ${formatBytes(finalSizes.dbFile)}, Conversations: ${conversations.length}`,
        );

        groups.push({
          memberCount,
          sizes: postSizes,
          finalSizes: finalSizes,
          conversationCount: conversations.length,
        });
      }

      // Print table of results
      console.log("\n📊 Storage Test Results:");
      console.log(
        "Members | DB Size | WAL Size | SHM Size | Conversations | Final DB Size | Est. Size",
      );
      console.log(
        "--------|---------|----------|----------|---------------|---------------|----------",
      );

      for (const group of groups) {
        const dbSize = formatBytes(group.sizes.dbFile);
        const walSize = formatBytes(group.sizes.walFile);
        const shmSize = formatBytes(group.sizes.shmFile);
        const finalDbSize = formatBytes(group.finalSizes.dbFile);
        const estimatedSize = formatBytes(
          group.sizes.walFile * 0.82 + group.sizes.dbFile,
        );
        console.log(
          `${group.memberCount.toString().padStart(7)} | ${dbSize.padStart(7)} | ${walSize.padStart(8)} | ${shmSize.padStart(8)} | ${group.conversationCount.toString().padStart(13)} | ${finalDbSize.padStart(11)} | ${estimatedSize.padStart(8)}`,
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
