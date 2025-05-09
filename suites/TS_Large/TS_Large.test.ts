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
import { afterAll, describe, expect, it } from "vitest";

const testName = "TS_Large";
loadEnv(testName);

describe(testName, async () => {
  const batchSize = 50;
  const total = 400;
  let workers: WorkerManager;
  let start: number;
  let hasFailures: boolean = false;
  let testStart: number;
  let newGroup: Conversation;
  const steamsToTest = [typeofStream.GroupUpdated];

  // Hold timing metrics per group size
  interface SummaryEntry {
    groupSize: number;
    messageStreamTimeMs?: number;
    groupUpdatedStreamTimeMs?: number;
    conversationStreamTimeMs?: number;
    syncTimeMs?: number;
  }

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(10, testName, steamsToTest[0]);

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
    it(`createLargeGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        console.log(`Creating group with ${i} participants`);
        const sliced = generatedInboxes.slice(0, i);

        // Measure creation time
        const createStart = performance.now();
        newGroup = await workers
          .getWorkers()[0]
          .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
        const creationTimeMs = performance.now() - createStart;

        expect(newGroup.id).toBeDefined();
        console.log(
          `Created group with ${i} participants in ${creationTimeMs.toFixed(2)}ms`,
        );

        if (
          steamsToTest.includes(typeofStream.Message) ||
          steamsToTest.includes(typeofStream.GroupUpdated)
        ) {
          const workersInboxIds = workers
            .getWorkers()
            .map((worker) => worker.inboxId);

          await (newGroup as Group).addMembers(workersInboxIds);
        }
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    if (steamsToTest.includes(typeofStream.Conversation)) {
      it(`verifyLargeConversationStream-${i}: should create a new conversation`, async () => {
        try {
          console.log("Testing conversation stream with new DM creation");

          // Use the dedicated conversation stream verification helper
          const verifyResult = await verifyConversationGroupStream(
            newGroup as Group,
            workers.getWorkers(),
            () => {
              start = performance.now();
            },
          );

          const streamTimeMs = performance.now() - start;
          console.log(
            `Conversation stream verification for ${i} participants took ${streamTimeMs.toFixed(2)}ms`,
          );

          expect(verifyResult.allReceived).toBe(true);

          // Save metrics
          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            conversationStreamTimeMs: streamTimeMs,
          };
        } catch (e) {
          hasFailures = logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    } else if (steamsToTest.includes(typeofStream.GroupUpdated)) {
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

          const streamTimeMs = performance.now() - start;
          console.log(
            `Group metadata update stream for ${i} participants took ${streamTimeMs.toFixed(2)}ms`,
          );

          expect(verifyResult.allReceived).toBe(true);

          // Save metrics
          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            groupUpdatedStreamTimeMs: streamTimeMs,
          };
        } catch (e) {
          hasFailures = logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    } else if (steamsToTest.includes(typeofStream.Message)) {
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

          const streamTimeMs = performance.now() - start;
          console.log(
            `Message stream for ${i} participants took ${streamTimeMs.toFixed(2)}ms`,
          );

          // Save metrics
          summaryMap[i] = {
            ...(summaryMap[i] ?? { groupSize: i }),
            messageStreamTimeMs: streamTimeMs,
          };

          expect(verifyResult.allReceived).toBe(true);
        } catch (e) {
          hasFailures = logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    }

    it(`verifySyncAll-${i}: should verify all streams and measure sync time per worker`, async () => {
      try {
        const syncStart = performance.now();
        await workers.getWorkers()[0].client.conversations.sync();
        const syncTimeMs = performance.now() - syncStart;

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          syncTimeMs,
        };
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    if (Object.keys(summaryMap).length === 0) {
      console.log("No timing data was collected.");
      return;
    }

    const sorted = Object.values(summaryMap).sort(
      (a, b) => a.groupSize - b.groupSize,
    );

    console.log("\n===== Timing Summary per Group Size =====");
    for (const entry of sorted) {
      const {
        groupSize,
        messageStreamTimeMs,
        groupUpdatedStreamTimeMs,
        conversationStreamTimeMs,
        syncTimeMs,
      } = entry;

      console.log(
        `Group ${groupSize} → ` +
          (messageStreamTimeMs !== undefined
            ? `Message: ${messageStreamTimeMs.toFixed(2)} ms; `
            : "") +
          (groupUpdatedStreamTimeMs !== undefined
            ? `GroupUpdated: ${groupUpdatedStreamTimeMs.toFixed(2)} ms; `
            : "") +
          (conversationStreamTimeMs !== undefined
            ? `Conversation: ${conversationStreamTimeMs.toFixed(2)} ms; `
            : ""),
      );
    }
    console.log("==========================================\n");
  });
});
