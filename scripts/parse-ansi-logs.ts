#!/usr/bin/env node
import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { fileURLToPath } from "url";

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
  try {
    console.log(`Processing: ${basename(inputPath)}`);

    const content = await readFile(inputPath, "utf-8");
    const cleanedContent = stripAnsi(content);

    await writeFile(outputPath, cleanedContent, "utf-8");

    const originalSize = Buffer.byteLength(content, "utf-8");
    const cleanedSize = Buffer.byteLength(cleanedContent, "utf-8");
    const savedBytes = originalSize - cleanedSize;

    console.log(`  ✓ Cleaned ${basename(inputPath)}`);
    console.log(`    Original: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`    Cleaned:  ${(cleanedSize / 1024).toFixed(1)} KB`);
    console.log(
      `    Saved:    ${(savedBytes / 1024).toFixed(1)} KB (${((savedBytes / originalSize) * 100).toFixed(1)}%)`,
    );
    console.log("");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${basename(inputPath)}:`, errorMessage);
  }
}

/**
 * Main function to process all raw-*.log files
 */
async function main(): Promise<void> {
  const logsDir = join(process.cwd(), "logs");
  const outputDir = join(logsDir, "cleaned");

  // Check if logs directory exists
  if (!existsSync(logsDir)) {
    console.error("❌ Logs directory not found:", logsDir);
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  try {
    // Read all files in logs directory
    const files = await readdir(logsDir);

    // Filter for raw-parse-*.log files
    const rawLogFiles = files.filter(
      (file) => file.startsWith("raw-parse-") && file.endsWith(".log"),
    );

    if (rawLogFiles.length === 0) {
      console.log("⚠️  No raw-*.log files found in logs directory");
      return;
    }

    console.log(`🔍 Found ${rawLogFiles.length} raw log files to process:`);
    rawLogFiles.forEach((file) => {
      console.log(`  - ${file}`);
    });
    console.log("");

    // Process each file
    let processedCount = 0;
    let totalOriginalSize = 0;
    let totalCleanedSize = 0;

    for (const file of rawLogFiles) {
      const inputPath = join(logsDir, file);
      const outputFileName = file.replace("raw-parse-", "cleaned-parse-");
      const outputPath = join(outputDir, outputFileName);

      const stats = await readFile(inputPath);
      totalOriginalSize += stats.length;

      await processLogFile(inputPath, outputPath);

      const cleanedStats = await readFile(outputPath);
      totalCleanedSize += cleanedStats.length;

      processedCount++;
    }

    // Summary
    console.log("📊 Summary:");
    console.log(`  Files processed: ${processedCount}`);
    console.log(
      `  Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Total cleaned size: ${(totalCleanedSize / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Total space saved: ${((totalOriginalSize - totalCleanedSize) / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Average reduction: ${(((totalOriginalSize - totalCleanedSize) / totalOriginalSize) * 100).toFixed(1)}%`,
    );
    console.log("");
    console.log(`✅ All files processed successfully!`);
    console.log(`📁 Cleaned files saved to: ${outputDir}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error reading logs directory:", errorMessage);
    process.exit(1);
  }
}

// Run the script if it's the main module
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file://${fileURLToPath(import.meta.url)}`;

if (isMainModule) {
  main().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Script failed:", errorMessage);
    process.exit(1);
  });
}

export { stripAnsi, processLogFile };
