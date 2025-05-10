import fs from "fs";
import generatedInboxes from "@helpers/generated-inboxes.json";
import type { WorkerManager } from "@workers/manager";
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
}

export const ts_large_createGroup = async (
  workers: WorkerManager,
  groupSize: number,
  addMembers: boolean,
): Promise<Group> => {
  const creator = workers.getWorkers()[0];
  const newGroup = await creator.client.conversations.newGroup(
    generatedInboxes.slice(0, groupSize).map((inbox) => inbox.inboxId),
  );
  console.log(`Group created with ${groupSize} participants`);
  if (addMembers) {
    console.log("Adding members to group");
    const workersInboxIds = workers
      .getWorkers()
      .map((worker) => worker.inboxId);

    await newGroup.addMembers(
      workersInboxIds.filter((id) => id !== creator.inboxId),
    );
    console.log(
      `Successfully added ${workersInboxIds.length} members to the group`,
    );
  }
  return newGroup;
};
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
    } = entry;

    messageToLog += `Group ${groupSize} → `;
    if (conversationStreamTimeMs !== undefined) {
      messageToLog += `New member stream: ${conversationStreamTimeMs.toFixed(2)} ms; `;
    }
    if (groupUpdatedStreamTimeMs !== undefined) {
      messageToLog += `Group updated stream: ${groupUpdatedStreamTimeMs.toFixed(2)} ms; `;
    }
    if (messageStreamTimeMs !== undefined) {
      messageToLog += `Message stream: ${messageStreamTimeMs.toFixed(2)} ms; `;
    }
    if (syncTimeMs !== undefined) {
      messageToLog += `Sync: ${syncTimeMs.toFixed(2)} ms; `;
    }
    if (createTimeMs !== undefined) {
      messageToLog += `Create: ${createTimeMs.toFixed(2)} ms; `;
    }
    messageToLog += "\n";
  }
  messageToLog += "\n";
  messageToLog += "==========================================\n";
  console.log(messageToLog);
  // save file in ./large.log
  fs.appendFileSync("logs/ts_large.log", messageToLog);
}
