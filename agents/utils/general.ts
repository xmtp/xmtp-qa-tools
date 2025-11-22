import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

export function loadEnvFile(scriptUrl?: string | URL) {
  // Check multiple locations in order of priority:
  // 1. Script's directory (if scriptUrl provided) - HIGHEST PRIORITY
  // 2. Current working directory
  // 3. Project root (../../.env from agents/utils/)

  if (scriptUrl) {
    const __filename = fileURLToPath(scriptUrl);
    const __dirname = dirname(__filename);
    const scriptEnvPath = join(__dirname, ".env");
    if (existsSync(scriptEnvPath)) {
      console.log(
        `[loadEnvFile] Loading .env from script directory: ${scriptEnvPath}`,
      );
      // Use dotenv.config() directly to ensure we load from the exact path
      dotenv.config({ path: scriptEnvPath, override: true });
      return; // Stop here - don't check other locations
    } else {
      console.log(
        `[loadEnvFile] No .env found in script directory: ${scriptEnvPath}`,
      );
    }
  }

  // Only check other locations if script directory doesn't have .env
  const cwdEnvPath = join(process.cwd(), ".env");
  if (existsSync(cwdEnvPath)) {
    console.log(
      `[loadEnvFile] Loading .env from current working directory: ${cwdEnvPath}`,
    );
    dotenv.config({ path: cwdEnvPath, override: true });
    return;
  }

  const rootEnvPath = join(process.cwd(), "../../.env");
  if (existsSync(rootEnvPath)) {
    console.log(`[loadEnvFile] Loading .env from project root: ${rootEnvPath}`);
    dotenv.config({ path: rootEnvPath, override: true });
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
