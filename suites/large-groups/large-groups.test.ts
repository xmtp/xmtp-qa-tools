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
  debugBATCH_SIZE,
  debugCHECK_INSTALLATIONS,
  debugTOTAL,
  debugWORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "large-groups";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  const summaryMap: Record<string, SummaryEntry> = {};

  workers = await getWorkers(
    getFixedNames(debugWORKER_COUNT),
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

  for (let i = debugBATCH_SIZE; i <= debugTOTAL; i += debugBATCH_SIZE) {
    for (const installation of debugCHECK_INSTALLATIONS) {
      const test = `${i}-${installation}: should create a new conversation of ${i} members with ${installation} installations`;
      it(test, async () => {
        try {
          console.log(test);
          const newGroup = (await workers
            .getCreator()
            .client.conversations.newGroup(
              workers.getAllButCreator().map((w) => w.client.inboxId),
            )) as Group;

          const inboxes = getInboxByInstallationCount(installation, i);
          const allInboxIds = [
            ...inboxes
              .slice(0, i - workers.getAllButCreator().length - 1)
              .map((inbox) => inbox.inboxId),
          ];
          // Add members in batches of 10
          const batchSize = 10;
          for (let j = 0; j < allInboxIds.length; j += batchSize) {
            const batch = allInboxIds.slice(j, j + batchSize);
            await newGroup.addMembers(batch);
          }
          await newGroup.sync();
          const members = await newGroup.members();

          const memberToAdd = inboxes[inboxes.length - 1].inboxId;
          const verifyResult = await verifyMembershipStream(
            newGroup,
            workers.getAllButCreator(),
            [memberToAdd],
          );
          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.receiverCount).toBeGreaterThan(0);

          let totalGroupInstallations = 0;
          for (const member of members) {
            totalGroupInstallations += member.installationIds.length;
          }
          console.warn(
            `Group created with ${members.length} members (${installation} installations) in batch ${i} - ID: ${newGroup.id} total installations: ${totalGroupInstallations}`,
          );

          const zWorkerName = "random" + `${i}-${installation}`;
          const zWorker = await getWorkers([zWorkerName], testName);
          await newGroup.addMembers([zWorker.getCreator().client.inboxId]);
          const zSyncAllStart = performance.now();
          await zWorker.getCreator().client.conversations.syncAll();
          const zSyncAllTimeMs = performance.now() - zSyncAllStart;
          console.warn(`SyncAll time: ${zSyncAllTimeMs}ms for ${zWorkerName}`);

          const summaryKey = `${i}-inst${installation}`;
          summaryMap[summaryKey] = {
            ...(summaryMap[summaryKey] ?? {
              groupSize: i,
              installations: installation,
              totalGroupInstallations,
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
