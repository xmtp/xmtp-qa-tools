import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Calculate agents folder root (one level up from utils/)
const agentsRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function loadEnvFile(scriptUrl?: string | URL) {
  // Check multiple locations in order of priority:
  // 1. Agents folder root - HIGHEST PRIORITY
  // 2. Script's directory (if scriptUrl provided)

  const agentsEnvPath = join(agentsRoot, ".env");
  if (existsSync(agentsEnvPath)) {
    console.log(
      `[loadEnvFile] Loading .env from agents folder: ${agentsEnvPath}`,
    );
    dotenv.config({ path: agentsEnvPath, override: false });
    return;
  }

  if (scriptUrl) {
    const __filename = fileURLToPath(scriptUrl);
    const __dirname = dirname(__filename);
    const scriptEnvPath = join(__dirname, ".env");
    if (existsSync(scriptEnvPath)) {
      console.log(
        `[loadEnvFile] Loading .env from script directory: ${scriptEnvPath}`,
      );
      dotenv.config({ path: scriptEnvPath, override: false });
    }
  }
}

export function getDbPathBase(): string {
  const agentsEnvPath = join(agentsRoot, ".env");
  if (existsSync(agentsEnvPath)) {
    return agentsRoot;
  }
  return process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".";
}

