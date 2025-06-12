import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

interface InboxItem {
  accountAddress: string;
  inboxId: string;
  walletKey: string;
  dbEncryptionKey: string;
  dbPath?: string;
  installations: number;
}

const __filename = fileURLToPath(import.meta.url);
const inboxesDir = path.dirname(__filename);

// Read all JSON files in the directory
const files = fs
  .readdirSync(inboxesDir)
  .filter((file) => file.endsWith(".json"));

files.forEach((file) => {
  const filePath = path.join(inboxesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as InboxItem[];

  // Remove dbPath from each object in the array
  const cleanedData = data.map((item: InboxItem) => {
    const { dbPath, ...rest } = item;
    return rest;
  });

  // Write back the cleaned data
  fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2));
  console.log(`Processed ${file}`);
});
