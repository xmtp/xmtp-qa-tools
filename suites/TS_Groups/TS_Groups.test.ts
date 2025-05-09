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
  const total = 400;
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
            uniqueInstallationIds.add(String(installationId ?? ""));
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
            continue;
          }

          console.log(`${worker.name} synced in ${syncTime.toFixed(2)}ms`);
          currentGroupResult.syncResults.push({
            groupSize: i,
            workerName: worker.name,
            syncTimeMs: syncTime,
            installationCount,
          });
        }
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
