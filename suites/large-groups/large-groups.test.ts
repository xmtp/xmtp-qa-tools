import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { getFixedNames, getInboxByInstallationCount } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { saveLog, type SummaryEntry } from "./helpers";

export const debugWORKER_COUNT = 5;
export const debugBATCH_SIZE = 100;
export const debugTOTAL = 200;
export const debugCHECK_INSTALLATIONS = [2, 5, 10, 20, 25];

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
      it(`receiveAddMember-${i}-inst${installation}: should create a new conversation of ${i} members with ${installation} installations`, async () => {
        try {
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
          console.log(allInboxIds.length);
          // Add members in batches of 10
          const batchSize = 10;
          for (let j = 0; j < allInboxIds.length; j += batchSize) {
            const batch = allInboxIds.slice(j, j + batchSize);
            await newGroup.addMembers(batch);
          }
          await newGroup.sync();
          const members = await newGroup.members();
          console.warn(
            `Group created with ${members.length} members (${installation} installations) in batch ${i} - ID: ${newGroup.id}`,
          );

          const memberToAdd = inboxes[inboxes.length - 1].inboxId;
          const verifyResult = await verifyMembershipStream(
            newGroup,
            workers.getAllButCreator(),
            [memberToAdd],
          );
          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.allReceived).toBe(true);

          let totalGroupInstallations = 0;
          for (const member of members) {
            totalGroupInstallations += member.installationIds.length;
          }
          console.warn(
            `Total group with ${members.length} members. installations: ${totalGroupInstallations}`,
          );
          // Save metrics with both group size and installation count
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
