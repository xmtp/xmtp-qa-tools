import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { verifyAddMembersStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";

const testName = "TS_Large";
loadEnv(testName);

describe(testName, async () => {
  const workersCount = 5;
  const batchSize = 50;
  const total = 400;
  const steamsToTest = [typeofStream.Conversation];
  let workers: WorkerManager;
  let start: number;

  let testStart: number;
  let newGroup: Conversation;

  // Hold timing metrics per group size
  interface SummaryEntry {
    groupSize: number;
    messageStreamTimeMs?: number;
    groupUpdatedStreamTimeMs?: number;
    conversationStreamTimeMs?: number;
    syncTimeMs?: number;
    createTimeMs?: number;
  }

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(workersCount, testName, steamsToTest[0]);

  setupTestLifecycle({
    expect,
    workers,
    testName,
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
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          createTimeMs: (summaryMap[i]?.createTimeMs ?? 0 + creationTimeMs) / 2,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    if (steamsToTest.includes(typeofStream.Conversation)) {
      it(`verifyLargeConversationStream-${i}: should create a new conversation`, async () => {
        try {
          console.log("Testing conversation stream with new DM creation");

          // Use the dedicated conversation stream verification helper
          const verifyResult = await verifyAddMembersStream(
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
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    }
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
      const { groupSize, conversationStreamTimeMs, syncTimeMs, createTimeMs } =
        entry;

      console.log(
        `Group ${groupSize} → ` +
          (conversationStreamTimeMs !== undefined
            ? `Conversation: ${conversationStreamTimeMs.toFixed(2)} ms; `
            : ""),
        createTimeMs !== undefined
          ? `Create: ${createTimeMs.toFixed(2)} ms; `
          : "",
        syncTimeMs !== undefined ? `Sync: ${syncTimeMs.toFixed(2)} ms; ` : "",
      );
    }
    console.log("==========================================\n");
  });
});
