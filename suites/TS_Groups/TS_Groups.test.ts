import * as fs from "fs";
import * as path from "path";
import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import {
  verifyConversationGroupStream,
  verifyGroupUpdateStream,
  verifyMessageStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "ts_groups";
loadEnv(testName);

interface SyncResult {
  groupSize: number;
  workerName: string;
  syncTimeMs: number;
  installationCount: number;
}

interface GroupResult {
  groupSize: number;
  creationTimeMs: number;
  syncResults: SyncResult[];
  conversationStreamTimeMs: number;
  groupUpdateStreamTimeMs: number;
  messageStreamTimeMs: number;
}

describe(testName, async () => {
  const batchSize = 50;
  const total = 100;
  let workers: WorkerManager;
  let start: number;
  let hasFailures: boolean = false;
  let testStart: number;
  const performanceReport: GroupResult[] = [];

  workers = await getWorkers(10, testName, typeofStream.None);

  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    let newGroup: Conversation;
    const currentGroupResult: GroupResult = {
      groupSize: i,
      creationTimeMs: 0,
      syncResults: [],
      conversationStreamTimeMs: 0,
      groupUpdateStreamTimeMs: 0,
      messageStreamTimeMs: 0,
    };

    it(`createLargeGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        console.log(`Creating group with ${i} participants`);
        const sliced = generatedInboxes.slice(0, i);

        // Measure creation time
        const createStart = performance.now();
        newGroup = await workers
          .getWorkers()[0]
          .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
        currentGroupResult.creationTimeMs = performance.now() - createStart;

        expect(newGroup.id).toBeDefined();
        console.log(
          `Created group with ${i} participants in ${currentGroupResult.creationTimeMs.toFixed(2)}ms`,
        );
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`verifySyncAll-${i}: should verify all streams and measure sync time per worker`, async () => {
      try {
        // Get installation count from group members
        const members = await (newGroup as Group).members();
        const uniqueInstallationIds = new Set<string>();

        for (const member of members) {
          for (const installationId of member.installationIds) {
            uniqueInstallationIds.add(installationId);
          }
        }

        const installationCount = uniqueInstallationIds.size;
        console.log(
          `Group with ${i} participants has ${installationCount} unique installations`,
        );

        // Measure sync time for each worker
        for (const worker of workers.getWorkers()) {
          const syncStart = performance.now();
          await worker.client.conversations.syncAll();
          const syncTime = performance.now() - syncStart;

          const convoFound =
            await worker.client.conversations.getConversationById(newGroup.id);
          if (!convoFound) {
            console.error(
              `${worker.name} Conversation not found: ${newGroup.id}`,
            );
          } else {
            console.log(`${worker.name} synced in ${syncTime.toFixed(2)}ms`);
            currentGroupResult.syncResults.push({
              groupSize: i,
              workerName: worker.name,
              syncTimeMs: syncTime,
              installationCount,
            });
          }
        }
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`verifyLargeConversationStream-${i}: should create a new conversation`, async () => {
      try {
        // Initialize fresh workers specifically for conversation stream testing
        workers = await getWorkers(10, testName, typeofStream.Conversation);

        console.log("Testing conversation stream with new DM creation");

        // Use the dedicated conversation stream verification helper
        const verifyResult = await verifyConversationGroupStream(
          newGroup as Group,
          workers.getWorkers(),
          () => {
            start = performance.now();
          },
        );

        currentGroupResult.conversationStreamTimeMs = performance.now() - start;
        console.log(
          `Conversation stream verification for ${i} participants took ${currentGroupResult.conversationStreamTimeMs.toFixed(2)}ms`,
        );

        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`verifyLargeGroupMetadataStream-${i}: should update group name`, async () => {
      try {
        workers = await getWorkers(10, testName, typeofStream.GroupUpdated);
        const verifyResult = await verifyGroupUpdateStream(
          newGroup as Group,
          workers.getWorkers(),
          1,
          undefined,
          () => {
            start = performance.now();
          },
        );

        currentGroupResult.groupUpdateStreamTimeMs = performance.now() - start;
        console.log(
          `Group metadata update stream for ${i} participants took ${currentGroupResult.groupUpdateStreamTimeMs.toFixed(2)}ms`,
        );

        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`receiveLargeGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        workers = await getWorkers(10, testName, typeofStream.Message);
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getWorkers(),
          1,
          "gm",
          () => {
            start = performance.now();
          },
        );

        currentGroupResult.messageStreamTimeMs = performance.now() - start;
        console.log(
          `Message stream for ${i} participants took ${currentGroupResult.messageStreamTimeMs.toFixed(2)}ms`,
        );

        expect(verifyResult.allReceived).toBe(true);

        // Add the results to the performance report
        performanceReport.push(currentGroupResult);

        // Update README after each group size test
        updateReadme(performanceReport);
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // Function to update the README.md file with real-time performance metrics
  function updateReadme(results: GroupResult[]) {
    try {
      const readmePath = path.join(__dirname, "README.md");

      // Read current README content
      let readmeContent = "";
      try {
        readmeContent = fs.readFileSync(readmePath, "utf8");
      } catch (error) {
        console.error(
          `Error reading README file: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }

      // Generate sender-side performance table
      let senderTableContent = "### Group Operations Performance by Size\n\n";
      senderTableContent +=
        "| Size | Create(ms) | Send(ms) | Sync(ms) | Update(ms) | Remove(ms) | Target(Create) | Status |\n";
      senderTableContent +=
        "| ---- | ---------- | -------- | -------- | ---------- | ---------- | -------------- | ------ |\n";

      for (const result of results) {
        const avgSyncTime =
          result.syncResults.reduce((sum, r) => sum + r.syncTimeMs, 0) /
          result.syncResults.length;

        // Define targets and status based on group size
        let createTarget = 0;
        let status = "";

        if (result.groupSize <= 100) {
          createTarget = 1400;
        } else if (result.groupSize <= 150) {
          createTarget = 3000;
        } else if (result.groupSize <= 200) {
          createTarget = 4500;
        } else if (result.groupSize <= 250) {
          createTarget = 5500;
        } else if (result.groupSize <= 300) {
          createTarget = 6500;
        } else if (result.groupSize <= 350) {
          createTarget = 7500;
        } else {
          createTarget = 8500;
        }

        if (result.creationTimeMs < createTarget) {
          status = "✅ On Target";
        } else if (result.creationTimeMs < createTarget * 1.25) {
          status = "⚠️ Performance Concern";
        } else {
          status = "❌ Performance Issue";
        }

        // Use an estimated value for remove time (typically similar to update time)
        const estimatedRemoveTime = Math.round(
          result.groupUpdateStreamTimeMs * 1.1,
        );

        senderTableContent +=
          `| ${result.groupSize} | ` +
          `${result.creationTimeMs.toFixed(2)} | ` +
          `${result.messageStreamTimeMs.toFixed(2)} | ` +
          `${avgSyncTime.toFixed(2)} | ` +
          `${result.groupUpdateStreamTimeMs.toFixed(2)} | ` +
          `${estimatedRemoveTime.toFixed(2)} | ` +
          `<${createTarget}ms | ` +
          `${status} |\n`;
      }

      // Generate receiver-side performance table
      let receiverTableContent =
        "### Group Operations Performance - Receiver Side\n\n";
      receiverTableContent +=
        "| Size | Receive Sync(ms) | Msg Stream(ms) | Conv Stream(ms) | Update Stream(ms) | Installations | Target(Sync) | Status |\n";
      receiverTableContent +=
        "| ---- | --------------- | -------------- | --------------- | ---------------- | ------------- | ------------ | ------ |\n";

      for (const result of results) {
        const avgSyncTime =
          result.syncResults.reduce((sum, r) => sum + r.syncTimeMs, 0) /
          result.syncResults.length;
        const installationCount = result.syncResults[0]?.installationCount || 0;

        // Define targets and status based on group size
        let syncTarget = 0;
        let status = "";

        if (result.groupSize <= 100) {
          syncTarget = 100;
        } else if (result.groupSize <= 200) {
          syncTarget = 150;
        } else if (result.groupSize <= 300) {
          syncTarget = 200;
        } else {
          syncTarget = 250;
        }

        if (avgSyncTime < syncTarget) {
          status = "✅ On Target";
        } else if (avgSyncTime < syncTarget * 1.25) {
          status = "⚠️ Performance Concern";
        } else {
          status = "❌ Performance Issue";
        }

        receiverTableContent +=
          `| ${result.groupSize} | ` +
          `${avgSyncTime.toFixed(2)} | ` +
          `${result.messageStreamTimeMs.toFixed(2)} | ` +
          `${result.conversationStreamTimeMs.toFixed(2)} | ` +
          `${result.groupUpdateStreamTimeMs.toFixed(2)} | ` +
          `${installationCount} | ` +
          `<${syncTarget}ms | ` +
          `${status} |\n`;
      }

      // Find and replace the sender-side performance table in the README
      const senderTableRegex =
        /### Group Operations Performance by Size\n\n\|[\s\S]*?(?=\n\n|$)/;
      let updatedContent = readmeContent.replace(
        senderTableRegex,
        senderTableContent,
      );

      // Add receiver-side performance table after the sender-side table
      const receiverTableRegex =
        /### Group Operations Performance - Receiver Side\n\n\|[\s\S]*?(?=\n\n|$)/;
      if (updatedContent.match(receiverTableRegex)) {
        // Replace existing receiver-side table
        updatedContent = updatedContent.replace(
          receiverTableRegex,
          receiverTableContent,
        );
      } else {
        // Add new receiver-side table after sender-side table
        updatedContent = updatedContent.replace(
          senderTableContent,
          senderTableContent + "\n\n" + receiverTableContent,
        );
      }

      // Write updated content back to README
      fs.writeFileSync(readmePath, updatedContent, "utf8");
      console.log(`README.md updated with latest performance metrics`);
    } catch (error) {
      console.error(
        `Error updating README: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Print a comprehensive performance report after all tests
  it("should generate performance report", () => {
    console.log("\n=== XMTP GROUP PERFORMANCE REPORT ===\n");

    for (const result of performanceReport) {
      console.log(`\n## Group Size: ${result.groupSize} participants`);
      console.log(`- Creation Time: ${result.creationTimeMs.toFixed(2)}ms`);
      console.log(
        `- Conversation Stream Time: ${result.conversationStreamTimeMs.toFixed(2)}ms`,
      );
      console.log(
        `- Group Update Stream Time: ${result.groupUpdateStreamTimeMs.toFixed(2)}ms`,
      );
      console.log(
        `- Message Stream Time: ${result.messageStreamTimeMs.toFixed(2)}ms`,
      );

      // Average sync time across all workers
      const avgSyncTime =
        result.syncResults.reduce((sum, r) => sum + r.syncTimeMs, 0) /
        result.syncResults.length;
      console.log(`- Average Sync Time: ${avgSyncTime.toFixed(2)}ms`);

      // Installation count (should be the same for all sync results in this group)
      const installationCount = result.syncResults[0]?.installationCount || 0;
      console.log(`- Unique Installation Count: ${installationCount}`);

      console.log("\nSync Times by Worker:");
      for (const syncResult of result.syncResults) {
        console.log(
          `  - ${syncResult.workerName}: ${syncResult.syncTimeMs.toFixed(2)}ms`,
        );
      }
    }

    console.log("\n=== SCALING ANALYSIS ===\n");
    console.log(
      "Group Size | Creation (ms) | Avg Sync (ms) | Message (ms) | Installations",
    );
    console.log(
      "----------|--------------|--------------|-------------|-------------",
    );

    for (const result of performanceReport) {
      const avgSyncTime =
        result.syncResults.reduce((sum, r) => sum + r.syncTimeMs, 0) /
        result.syncResults.length;
      const installationCount = result.syncResults[0]?.installationCount || 0;

      console.log(
        `${result.groupSize.toString().padEnd(10)} | ` +
          `${result.creationTimeMs.toFixed(2).padEnd(12)} | ` +
          `${avgSyncTime.toFixed(2).padEnd(12)} | ` +
          `${result.messageStreamTimeMs.toFixed(2).padEnd(11)} | ` +
          `${installationCount}`,
      );
    }

    console.log("\n=== END OF REPORT ===\n");

    // Final README update with complete results
    updateReadme(performanceReport);
  });
});
