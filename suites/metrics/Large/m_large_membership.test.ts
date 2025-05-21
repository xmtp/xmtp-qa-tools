import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { getInboxIds, getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
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
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getRandomNames(m_large_WORKER_COUNT),
    testName,
    typeofStream.GroupUpdated,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
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
    it(`receiveAddMember-${i}: should create a new conversation`, async () => {
      try {
        const creator = workers.getCreator();
        newGroup = await creator.client.conversations.newGroup(getInboxIds(i));
        await newGroup.addMembers(
          workers.getAllButCreator().map((worker) => worker.client?.inboxId),
        );
        // Use the dedicated conversation stream verification helper
        const verifyResult = await verifyMembershipStream(
          newGroup,
          workers.getAllButCreator(),
          getInboxIds(i),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.allReceived).toBe(true);

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
