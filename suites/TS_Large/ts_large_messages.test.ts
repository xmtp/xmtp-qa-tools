import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  saveLog,
  TS_LARGE_BATCH_SIZE,
  TS_LARGE_TOTAL,
  TS_LARGE_WORKER_COUNT,
  type SummaryEntry,
} from "./helpers";

const testName = "ts_large_messages";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  let newGroup: Conversation;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames(TS_LARGE_WORKER_COUNT),
    testName,
    typeofStream.Message,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    expect,
    workers,
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });

  for (
    let i = TS_LARGE_BATCH_SIZE;
    i <= TS_LARGE_TOTAL;
    i += TS_LARGE_BATCH_SIZE
  ) {
    it(`receiveMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const creator = workers.getCreator();
        newGroup = await creator.client.conversations.newGroup(
          generatedInboxes.slice(0, i).map((inbox) => inbox.inboxId),
        );
        await (newGroup as Group).addMembers(
          workers.getAllButCreator().map((worker) => worker.inboxId),
        );
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getWorkers(),
        );

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          messageStreamTimeMs: verifyResult.averageEventTiming,
        };

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // Aft
  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
