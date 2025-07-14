import fs from "fs";

export const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "5");
export const MAX_GROUP_SIZE = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

export function saveLog(summaryMap: Record<string, any>) {
  if (Object.keys(summaryMap).length === 0) {
    return;
  }

  const sorted = Object.values(summaryMap).sort(
    (a, b) =>
      a.groupSize - b.groupSize ||
      (a.installations ?? 0) - (b.installations ?? 0),
  );

  let messageToLog = "\n===== Performance Summary =====\n";

  for (const entry of sorted) {
    messageToLog += `Group ${entry.groupSize}`;
    if (entry.installations !== undefined) {
      messageToLog += ` (${entry.installations} inst)`;
    }
    messageToLog += " → ";
    messageToLog += JSON.stringify(entry, null, 0);
    messageToLog += "\n";
  }

  messageToLog += "\n==========================================\n";
  console.log(messageToLog);
  fs.appendFileSync("logs/large.log", messageToLog);
}
