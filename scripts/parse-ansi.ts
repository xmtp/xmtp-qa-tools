#!/usr/bin/env node
import { cleanAllRawLogs } from "@helpers/logger";

/**
 * This script is now a thin wrapper around the cleanAllRawLogs function
 * which has been moved to the logger module for better organization.
 */

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanAllRawLogs().catch(() => process.exit(1));
}

// Re-export the functions for compatibility
export { stripAnsi, processLogFile, cleanAllRawLogs } from "@helpers/logger";
