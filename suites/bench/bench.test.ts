import fs from "fs";
import { getTime, logError } from "@helpers/logger";
import { verifyMembershipStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxByInstallationCount } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";

export const WORKER_COUNT = 3;
export const BATCH_SIZE = 10;
export const TOTAL = 200;
export const CHECK_INSTALLATIONS = [2, 5, 10, 15, 20, 25];
export const MIN_MAX_INSTALLATIONS = [1000, 2000];

describe("bench", () => {
  let workers: WorkerManager;

  const summaryMap: Record<string, SummaryEntry> = {};

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });

  for (let i = BATCH_SIZE; i <= TOTAL; i += BATCH_SIZE) {
    for (const installation of CHECK_INSTALLATIONS) {
      if (
        installation * i < MIN_MAX_INSTALLATIONS[0] ||
        installation * i > MIN_MAX_INSTALLATIONS[1]
      ) {
        console.log(
          `Skipping test for: ${installation * i} installations (min: ${MIN_MAX_INSTALLATIONS[0]}, max: ${MIN_MAX_INSTALLATIONS[1]})`,
        );
        continue;
      }
      const test = `${i}-${installation}: should create a new conversation of ${i} members with ${installation} installations`;
      console.log(test);
      it(test, async () => {
        try {
          workers = await getWorkers(WORKER_COUNT);

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
            console.log(
              `${j} of ${allInboxIds.length} - Added ${batch.length} members`,
            );
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
          const zWorker = await getWorkers([zWorkerName]);
          await newGroup.addMembers([zWorker.getCreator().client.inboxId]);
          const zSyncAllStart = performance.now();
          await zWorker.getCreator().client.conversations.syncAll();
          const zSyncAllTimeMs = performance.now() - zSyncAllStart;
          console.warn(`SyncAll time: ${zSyncAllTimeMs}ms for ${zWorkerName}`);

          const summaryKey = `${i}-${installation}`;
          summaryMap[summaryKey] = {
            ...(summaryMap[summaryKey] ?? {
              groupSize: i,
              installations: installation,
              totalGroupInstallations,
              addMembersTimeMs: verifyResult.averageEventTiming,
              zSyncAllTimeMs,
            }),
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

export interface SummaryEntry {
  groupSize: number;
  installations?: number;
  addMembersTimeMs?: number;
  totalGroupInstallations?: number;
  zSyncAllTimeMs?: number;
}

export function saveLog(summaryMap: Record<string, SummaryEntry>) {
  if (Object.keys(summaryMap).length === 0) {
    return;
  }

  const sorted = Object.values(summaryMap).sort(
    (a, b) =>
      (a.totalGroupInstallations ?? 0) - (b.totalGroupInstallations ?? 0),
  );

  let messageToLog = "\n## Large Groups Performance Results\n\n";

  // Helper function to pad strings to a specific width
  const padString = (str: string, width: number) => {
    return str.padEnd(width);
  };

  // Define column widths
  const colWidths = {
    groupSize: 12,
    installations: 21,
    actualInstallations: 21,
    estimatedInstallations: 21,
    installationDiff: 21,
    addMembers: 18,
    syncAll: 14,
    timePerInstall: 22,
  };

  // Table headers
  messageToLog += padString("Group Size", colWidths.groupSize) + " | ";
  messageToLog += padString("Inst/Member", colWidths.installations) + " | ";
  messageToLog +=
    padString("Actual Inst", colWidths.actualInstallations) + " | ";
  messageToLog += padString("Diff", colWidths.installationDiff) + " | ";
  messageToLog +=
    padString("Est. Inst", colWidths.estimatedInstallations) + " | ";
  messageToLog += padString("Add Members (ms)", colWidths.addMembers) + " | ";
  messageToLog += padString("SyncAll (ms)", colWidths.syncAll) + " | ";
  messageToLog +=
    padString("Time per Install (ms)", colWidths.timePerInstall) + " |\n";

  // Separator line
  messageToLog += "-".repeat(colWidths.groupSize) + "-|-";
  messageToLog += "-".repeat(colWidths.installations) + "-|-";
  messageToLog += "-".repeat(colWidths.actualInstallations) + "-|-";
  messageToLog += "-".repeat(colWidths.installationDiff) + "-|-";
  messageToLog += "-".repeat(colWidths.estimatedInstallations) + "-|-";
  messageToLog += "-".repeat(colWidths.addMembers) + "-|-";
  messageToLog += "-".repeat(colWidths.syncAll) + "-|-";
  messageToLog += "-".repeat(colWidths.timePerInstall) + "-|\n";

  // CSV header
  let csvContent =
    "Group Size,Inst/Member,Actual Inst,Diff,Est. Inst,Add Members (ms),SyncAll (ms),Time per Install (ms)\n";

  // Table rows
  for (const entry of sorted) {
    const {
      groupSize,
      installations,
      addMembersTimeMs,
      totalGroupInstallations,
      zSyncAllTimeMs,
    } = entry;

    const estimatedInstallations = installations
      ? groupSize * installations
      : "N/A";
    const installationDiff =
      installations && totalGroupInstallations
        ? totalGroupInstallations - groupSize * installations
        : "N/A";

    const timePerInstall =
      addMembersTimeMs && totalGroupInstallations
        ? (addMembersTimeMs / totalGroupInstallations).toFixed(2)
        : "N/A";

    messageToLog +=
      padString(groupSize.toString(), colWidths.groupSize) + " | ";
    messageToLog +=
      padString((installations ?? "N/A").toString(), colWidths.installations) +
      " | ";
    messageToLog +=
      padString(
        (totalGroupInstallations ?? "N/A").toString(),
        colWidths.actualInstallations,
      ) + " | ";
    messageToLog +=
      padString(installationDiff.toString(), colWidths.installationDiff) +
      " | ";
    messageToLog +=
      padString(
        estimatedInstallations.toString(),
        colWidths.estimatedInstallations,
      ) + " | ";
    messageToLog +=
      padString(
        (addMembersTimeMs?.toFixed(2) ?? "N/A").toString(),
        colWidths.addMembers,
      ) + " | ";
    messageToLog +=
      padString(
        (zSyncAllTimeMs?.toFixed(2) ?? "N/A").toString(),
        colWidths.syncAll,
      ) + " | ";
    messageToLog +=
      padString(timePerInstall.toString(), colWidths.timePerInstall) + " |\n";

    // Add CSV row
    csvContent += `${groupSize},${installations ?? "N/A"},${totalGroupInstallations ?? "N/A"},${installationDiff},${estimatedInstallations},${addMembersTimeMs?.toFixed(2) ?? "N/A"},${zSyncAllTimeMs?.toFixed(2) ?? "N/A"},${timePerInstall}\n`;
  }

  messageToLog += "\n";
  console.log(messageToLog);

  // Save log file
  fs.appendFileSync("logs/bench " + getTime() + ".log", messageToLog);

  // Save CSV file
  fs.writeFileSync("logs/bench " + getTime() + ".csv", csvContent);
}
