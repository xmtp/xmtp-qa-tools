import { logError } from "@helpers/logger";
import { verifyNewConversationStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  m_large_WORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_conversations";

describe(testName, async () => {
  let workers = await getWorkers(m_large_WORKER_COUNT);

  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    expect,
    workers,
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
    it(`receiveNewConversation-${i}: should create ${i} member group`, async () => {
      try {
        const creator = workers.getCreator();
        newGroup = (await creator.client.conversations.newGroup(
          getInboxIds(i),
        )) as Group;
        // Use the dedicated conversation stream verification helper
        const verifyResult = await verifyNewConversationStream(
          newGroup,
          workers.getAllButCreator(),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.almostAllReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          conversationStreamTimeMs: verifyResult.averageEventTiming,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
