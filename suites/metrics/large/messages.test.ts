import { getFixedNames } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  m_large_WORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_messages";

describe(testName, async () => {
  let workers: WorkerManager;
  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getFixedNames(m_large_WORKER_COUNT),
    testName,
    typeofStream.Message,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    expect,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });

  for (
    let i = m_large_BATCH_SIZE;
    i <= m_large_TOTAL;
    i += m_large_BATCH_SIZE
  ) {
    it(`receiveGroupMessage-${i}: should deliver messages to all ${i}`, async () => {
      try {
        const creator = workers.getCreator();
        newGroup = (await creator.client.conversations.newGroup(
          getInboxIds(i),
        )) as Group;
        await newGroup.sync();
        await newGroup.addMembers(
          workers.getAllButCreator().map((worker) => worker.client.inboxId),
        );
        await newGroup.sync();
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getAllButCreator(),
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
