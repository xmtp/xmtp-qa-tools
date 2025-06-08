import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { getFixedNames, getInboxByIndex, getInboxIds } from "@helpers/utils";
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

  const installations = [2];

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getFixedNames(m_large_WORKER_COUNT),
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
    for (const installation of installations) {
      it(`receiveAddMember-${i}: should create a new conversation of ${installation} members`, async () => {
        try {
          const allInboxIds = [
            ...workers.getAllButCreator().map((w) => w.client.inboxId),
            getInboxByIndex(installation, 10).inboxId,
          ];
          const newGroup = (await workers
            .getCreator()
            .client.conversations.newGroup(allInboxIds)) as Group;

          console.log(
            "Group created with",
            "members",
            allInboxIds.length,
            "of",
            installations,
            "installations",
            "and id",
            newGroup.id,
          );

          const verifyResult = await verifyMembershipStream(
            newGroup,
            workers.getAllButCreator(),
            [getInboxByIndex(installation, 191).inboxId],
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
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
