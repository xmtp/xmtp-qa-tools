import { verifyMetadataStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  m_large_WORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_metadata";
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
    it(`receiveGroupUpdated-${i}: should create ${i} member group`, async () => {
      const creator = workers.getCreator();
      newGroup = (await creator.client.conversations.newGroup(
        getInboxIds(i),
      )) as Group;

      await newGroup.addMembers(
        workers.getAllButCreator().map((worker) => worker.inboxId),
      );
      const verifyResult = await verifyMetadataStream(
        newGroup,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);

      // Save metrics
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        groupUpdatedStreamTimeMs: verifyResult.averageEventTiming,
      };
    });
  }

  // Aft
  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
