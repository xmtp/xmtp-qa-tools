import { getFixedNames } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
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

const testName = "m_large_membership";

describe(testName, async () => {
  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  let workers = await getWorkers(getFixedNames(m_large_WORKER_COUNT));
  // Start group updated streams for membership tests
  workers.getAll().forEach((worker) => {
    worker.worker.startStream(typeofStream.GroupUpdated);
  });

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
    it(`receiveMembershipUpdate-${i}: should add members to ${i} member group`, async () => {
      try {
        // Initialize workers
        newGroup = await workers.createGroupBetweenAll();
        const verifyResult = await verifyMembershipStream(
          newGroup,
          workers.getAllButCreator(),
          getInboxIds(1),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.almostAllReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          addMembersTimeMs: verifyResult.averageEventTiming,
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
