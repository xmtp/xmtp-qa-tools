import fs from "fs";

export const m_large_WORKER_COUNT = 5;
export const m_large_BATCH_SIZE = 50;
export const m_large_TOTAL = 50;

export interface SummaryEntry {
  groupSize: number;
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

    messageToLog += `Group ${groupSize} → `;

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
