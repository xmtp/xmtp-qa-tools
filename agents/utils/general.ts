import { existsSync } from "fs";

export function loadEnvFile() {
  // Only do this in the gm example because it's called from the root
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  } else if (existsSync(`../../.env`)) {
    process.loadEnvFile(`../../.env`);
  }
}

export function shouldSkipOldMessage(
  messageTimestamp: number,
  startupTimestamp: number,
  skippedCount: { count: number },
  totalConversations: number,
): boolean {
  if (messageTimestamp >= startupTimestamp) {
    return false;
  }

  const ageMs = startupTimestamp - messageTimestamp;
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;
  const ageDisplay =
    ageDays >= 1
      ? `${ageDays.toFixed(1)} days`
      : `${ageHours.toFixed(1)} hours`;

  skippedCount.count++;
  console.log(
    `Skipping message because it was sent before startup (${ageDisplay} old, skipped: ${skippedCount.count}) for total conversations: ${totalConversations}`,
  );
  return true;
}
