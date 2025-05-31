#!/usr/bin/env node
import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Remove ANSI escape codes from text
 * This regex matches all ANSI escape sequences including:
 * - Color codes (\x1b[31m, \x1b[0m, etc.)
 * - Cursor movement codes
 * - Other terminal control sequences
 */
function stripAnsi(text: string): string {
  // ANSI escape code regex pattern
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;

  // Also handle some common ANSI sequences that might be encoded differently
  // eslint-disable-next-line no-control-regex
  const ansiRegex2 = /\u001b\[[0-9;]*[a-zA-Z]/g;

  return (
    text
      .replace(ansiRegex, "")
      .replace(ansiRegex2, "")
      // Remove any remaining control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => {
        // Keep newlines, tabs, and carriage returns
        if (char === "\n" || char === "\t" || char === "\r") {
          return char;
        }
        return "";
      })
  );
}

/**
 * Process a single log file
 */
async function processLogFile(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const content = await readFile(inputPath, "utf-8");
  const cleanedContent = stripAnsi(content);
  await writeFile(outputPath, cleanedContent, "utf-8");
}

/**
 * Main function to process all raw-*.log files
 */
async function main(): Promise<void> {
  const logsDir = join(process.cwd(), "logs");
  const outputDir = join(logsDir, "cleaned");

  if (!existsSync(logsDir)) {
    process.exit(1);
  }

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const files = await readdir(logsDir);
  const rawLogFiles = files.filter(
    (file) => file.startsWith("raw-parse-") && file.endsWith(".log"),
  );

  if (rawLogFiles.length === 0) {
    return;
  }

  for (const file of rawLogFiles) {
    const inputPath = join(logsDir, file);
    const outputFileName = file.replace("raw-parse-", "cleaned-parse-");
    const outputPath = join(outputDir, outputFileName);

    try {
      await processLogFile(inputPath, outputPath);
    } catch {
      // Silent fail
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => process.exit(1));
}

export { stripAnsi, processLogFile };
