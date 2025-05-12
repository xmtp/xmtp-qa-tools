import fs from "fs";
import generatedInboxes from "@helpers/generated-inboxes.json";
import type { Worker, WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";

export const TS_LARGE_WORKER_COUNT = 5;
export const TS_LARGE_BATCH_SIZE = 50;
export const TS_LARGE_TOTAL = 400;

export interface SummaryEntry {
  groupSize: number;
  messageStreamTimeMs?: number;
  groupUpdatedStreamTimeMs?: number;
  conversationStreamTimeMs?: number;
  syncTimeMs?: number;
  createTimeMs?: number;
  workerName?: string;
  singleSyncAllTimeMs?: number;
  singleSyncTimeMs?: number;
  cumulativeSyncAllTimeMs?: number;
  cumulativeSyncTimeMs?: number;
}

export function saveLog(summaryMap: Record<number, SummaryEntry>) {
  if (Object.keys(summaryMap).length === 0) {
    console.log("No timing data was collected.");
    return;
  }

  const sorted = Object.values(summaryMap).sort(
    (a, b) => a.groupSize - b.groupSize,
  );
  let messageToLog = "";
  messageToLog += "\n===== Timing Summary per Group Size =====\n";
  for (const entry of sorted) {
    const {
      groupSize,
      conversationStreamTimeMs,
      groupUpdatedStreamTimeMs,
      messageStreamTimeMs,
      syncTimeMs,
      createTimeMs,
      singleSyncAllTimeMs,
      singleSyncTimeMs,
      cumulativeSyncAllTimeMs,
      cumulativeSyncTimeMs,
    } = entry;

    messageToLog += `Group ${groupSize} → `;
    if (conversationStreamTimeMs !== undefined) {
      messageToLog += `New members: ${conversationStreamTimeMs.toFixed(2)} ms; `;
    }
    if (groupUpdatedStreamTimeMs !== undefined) {
      messageToLog += `Metadata: ${groupUpdatedStreamTimeMs.toFixed(2)} ms; `;
    }
    if (messageStreamTimeMs !== undefined) {
      messageToLog += `Messages: ${messageStreamTimeMs.toFixed(2)} ms; `;
    }
    if (syncTimeMs !== undefined) {
      messageToLog += `Sync: ${syncTimeMs.toFixed(2)} ms; `;
    }
    if (createTimeMs !== undefined) {
      messageToLog += `Create: ${createTimeMs.toFixed(2)} ms; `;
    }
    if (singleSyncAllTimeMs !== undefined) {
      messageToLog += `SingleSyncAll: ${singleSyncAllTimeMs.toFixed(2)} ms; `;
    }
    if (singleSyncTimeMs !== undefined) {
      messageToLog += `SingleSync: ${singleSyncTimeMs.toFixed(2)} ms; `;
    }
    if (cumulativeSyncAllTimeMs !== undefined) {
      messageToLog += `CumulativeSyncAll: ${cumulativeSyncAllTimeMs.toFixed(2)} ms; `;
    }
    if (cumulativeSyncTimeMs !== undefined) {
      messageToLog += `CumulativeSync: ${cumulativeSyncTimeMs.toFixed(2)} ms; `;
    }
    messageToLog += "\n";
  }
  messageToLog += "\n";
  messageToLog += "==========================================\n";
  console.log(messageToLog);
  // save file in ./large.log
  fs.appendFileSync("logs/ts_large.log", messageToLog);
}
