import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { getFixedNames, getInboxByInstallationCount } from "@helpers/utils";
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

export const m_large_CHECK_INSTALLATIONS = [2, 5];

const testName = "m_large_membership";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  const summaryMap: Record<string, SummaryEntry> = {};

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
    for (const installation of m_large_CHECK_INSTALLATIONS) {
      it(`receiveAddMember-${i}-inst${installation}: should create a new conversation of ${i} members with ${installation} installations`, async () => {
        try {
          const inboxes = getInboxByInstallationCount(installation, i);
          const allInboxIds = [
            ...workers.getAllButCreator().map((w) => w.client.inboxId),
            ...inboxes
              .slice(0, i - workers.getAllButCreator().length - 1)
              .map((inbox) => inbox.inboxId),
          ];
          const newGroup = (await workers
            .getCreator()
            .client.conversations.newGroup(allInboxIds)) as Group;

          const members = await newGroup.members();

          console.log(
            "Group created with",
            members.length,
            "of",
            installation,
            "installations",
            "in a batch of",
            i,
            "and id",
            newGroup.id,
          );
          const memberToAdd = inboxes[inboxes.length - 1].inboxId;
          console.log("memberToAdd", memberToAdd);
          const verifyResult = await verifyMembershipStream(
            newGroup,
            workers.getAllButCreator(),
            [memberToAdd],
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.allReceived).toBe(true);

          // Save metrics with both group size and installation count
          const summaryKey = `${i}-inst${installation}`;
          summaryMap[summaryKey] = {
            ...(summaryMap[summaryKey] ?? {
              groupSize: i,
              installations: installation,
            }),
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
