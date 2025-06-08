import fs from "fs";

export const m_large_WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
export const m_large_BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "5");
export const m_large_TOTAL = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

export interface SummaryEntry {
  groupSize: number;
  installations?: number;
  messageStreamTimeMs?: number;
  groupUpdatedStreamTimeMs?: number;
  addMembersTimeMs?: number;
  conversationStreamTimeMs?: number;
  syncTimeMs?: number;
  createTimeMs?: number;
  workerName?: string;
  singleSyncAllTimeMs?: number;
  singleSyncTimeMs?: number;
  cumulativeSyncAllTimeMs?: number;
  cumulativeSyncTimeMs?: number;
}

export function saveLog(summaryMap: Record<string, SummaryEntry>) {
  if (Object.keys(summaryMap).length === 0) {
    return;
  }

  const sorted = Object.values(summaryMap).sort(
    (a, b) =>
      a.groupSize - b.groupSize ||
      (a.installations ?? 0) - (b.installations ?? 0),
  );
  let messageToLog = "";
  messageToLog +=
    "\n===== Timing Summary per Group Size and Installations =====\n";
  for (const entry of sorted) {
    const {
      groupSize,
      installations,
      conversationStreamTimeMs,
      addMembersTimeMs,
      groupUpdatedStreamTimeMs,
      messageStreamTimeMs,
      syncTimeMs,
      createTimeMs,
      singleSyncAllTimeMs,
      singleSyncTimeMs,
      cumulativeSyncAllTimeMs,
      cumulativeSyncTimeMs,
    } = entry;

    messageToLog += `Group ${groupSize}`;
    if (installations !== undefined) {
      messageToLog += ` (${installations} inst)`;
    }
    messageToLog += ` → `;

    if (conversationStreamTimeMs !== undefined) {
      messageToLog += `New Group: ${conversationStreamTimeMs.toFixed(2)} ms; `;
    }
    if (addMembersTimeMs !== undefined) {
      messageToLog += `Add Members: ${addMembersTimeMs.toFixed(2)} ms; `;
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
  fs.appendFileSync("logs/large.log", messageToLog);
}
