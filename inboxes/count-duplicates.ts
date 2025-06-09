import * as fs from "fs";

const INBOXES_DIR = "./inboxes";

// Type definition for inbox data
interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations?: number;
  dbPath?: string;
}

// Simple progress indicator
function showProgress(current: number, total: number, filename: string) {
  const percentage = Math.round((current / total) * 100);
  process.stdout.write(
    `\r🔍 Processing: ${filename} (${current}/${total}) ${percentage}%`,
  );
}

// Count duplicates based only on inboxId
function countInboxIdDuplicates(inboxes: InboxData[]): {
  inboxIdDuplicates: number;
  duplicateInboxIds: string[];
} {
  const inboxIdCounts = new Map<string, number>();
  for (const inbox of inboxes) {
    inboxIdCounts.set(
      inbox.inboxId,
      (inboxIdCounts.get(inbox.inboxId) || 0) + 1,
    );
  }
  const duplicateInboxIds = Array.from(inboxIdCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([inboxId]) => inboxId);
  return {
    inboxIdDuplicates: duplicateInboxIds.length,
    duplicateInboxIds,
  };
}

// Main function to analyze all JSON files (only inboxId duplicates)
function analyzeAllFiles(): void {
  console.log(`🔍 XMTP Duplicate InboxId Counter\n`);
  console.log(`📁 Analyzing JSON files in ${INBOXES_DIR}\n`);

  if (!fs.existsSync(INBOXES_DIR)) {
    console.error(`❌ Directory ${INBOXES_DIR} does not exist`);
    return;
  }

  // Get all JSON files that match the pattern (number.json)
  const files = fs
    .readdirSync(INBOXES_DIR)
    .filter((file) => file.endsWith(".json") && /^\d+\.json$/.test(file))
    .sort((a, b) => {
      const numA = parseInt(a.replace(".json", ""));
      const numB = parseInt(b.replace(".json", ""));
      return numA - numB;
    });

  if (files.length === 0) {
    console.log(`📄 No JSON files found in ${INBOXES_DIR}`);
    return;
  }

  let totalDuplicatesAcrossFiles = 0;
  let totalFilesWithDuplicates = 0;
  const results: Array<{
    filename: string;
    count: number;
    inboxIdDuplicates: number;
    duplicateInboxIds: string[];
  }> = [];

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = `${INBOXES_DIR}/${file}`;

    showProgress(i + 1, files.length, file);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (!Array.isArray(data)) {
        console.log(`\n⚠️  ${file}: Not an array, skipping`);
        continue;
      }

      // Type check the array elements
      const isValidInboxData = (item: any): item is InboxData => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof item.accountAddress === "string" &&
          typeof item.walletKey === "string" &&
          typeof item.dbEncryptionKey === "string" &&
          typeof item.inboxId === "string"
        );
      };

      const validData = data.filter(isValidInboxData);

      if (validData.length !== data.length) {
        console.log(
          `\n⚠️  ${file}: ${data.length - validData.length} invalid records skipped`,
        );
      }

      const count = validData.length;
      const { inboxIdDuplicates, duplicateInboxIds } =
        countInboxIdDuplicates(validData);

      results.push({
        filename: file,
        count,
        inboxIdDuplicates,
        duplicateInboxIds,
      });

      if (inboxIdDuplicates > 0) {
        totalFilesWithDuplicates++;
        totalDuplicatesAcrossFiles += inboxIdDuplicates;
      }
    } catch (error: unknown) {
      console.log(
        `\n❌ ${file}: Error reading file - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Clear progress line
  console.log(`\n`);

  // Display results
  console.log(`📋 DUPLICATE INBOXID ANALYSIS RESULTS\n`);
  console.log(
    `${"File".padEnd(15)} ${"Accounts".padEnd(10)} ${"InboxID Duplicates".padEnd(18)} Duplicate InboxIds (first 3)`,
  );
  console.log("─".repeat(85));

  for (const result of results) {
    const { filename, count, inboxIdDuplicates, duplicateInboxIds } = result;
    console.log(
      `${filename.padEnd(15)} ${count.toString().padEnd(10)} ${inboxIdDuplicates.toString().padEnd(18)} ${duplicateInboxIds.slice(0, 3).join(", ")}${duplicateInboxIds.length > 3 ? ", ..." : ""}`,
    );
  }

  // Summary
  console.log("─".repeat(85));
  console.log(`\n📈 SUMMARY:`);
  console.log(`   📄 Total files analyzed: ${files.length}`);
  console.log(
    `   🔄 Total files with duplicate inboxIds: ${totalFilesWithDuplicates}`,
  );
  console.log(
    `   🔄 Total duplicate inboxIds found: ${totalDuplicatesAcrossFiles}`,
  );
  console.log(`\n🎉 Analysis complete!`);
}

analyzeAllFiles();

export { analyzeAllFiles, countInboxIdDuplicates };
