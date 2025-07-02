import { verifyMembershipStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  m_large_WORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

describe("m_large_membership", async () => {
  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  let workers = await getWorkers(m_large_WORKER_COUNT);

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
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
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
