#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateEncryptionKeyHex } from "@helpers/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

function showHelp() {
  console.log(`
XMTP Keys CLI - Generate wallet keys and encryption keys

USAGE:
  yarn gen:keys [options]

OPTIONS:
  --env <environment>   XMTP environment (local, dev, production) [default: dev]
  -h, --help            Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

DESCRIPTION:
  Generates a new wallet key and encryption key, then writes them to a .env file
  in the current directory. If a .env file already exists, the new keys will be
  appended to it.

EXAMPLES:
  yarn gen:keys
  yarn gen:keys --env production
  yarn gen:keys --help

For more information, see: cli/readme.md
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Check Node.js version
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split(".").map(Number);
  if (major < 20) {
    console.error("Error: Node.js version 20 or higher is required");
    process.exit(1);
  }

  // Parse environment
  let env = "dev";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === "--env" && nextArg) {
      env = nextArg;
      i++;
    }
  }

  console.log("Generating keys...");

  const walletKey = generatePrivateKey();
  const account = privateKeyToAccount(walletKey);
  const encryptionKeyHex = generateEncryptionKeyHex();
  const publicKey = account.address;

  // Get the current working directory (should be the example directory)
  const exampleDir = process.cwd();
  const exampleName = exampleDir.split("/").pop() || "example";
  const filePath = join(exampleDir, ".env");

  console.log(`Creating .env file in: ${exampleDir}`);

  // Read existing .env file if it exists
  let existingEnv = "";
  try {
    existingEnv = await readFile(filePath, "utf-8");
    console.log("Found existing .env file");
  } catch {
    // File doesn't exist, that's fine
    console.log("No existing .env file found, creating new one");
  }

  // Check if XMTP_ENV is already set
  const xmtpEnvExists = existingEnv.includes("XMTP_ENV=");

  const envContent = `# keys for ${exampleName}
XMTP_WALLET_KEY=${walletKey}
XMTP_DB_ENCRYPTION_KEY=${encryptionKeyHex}
${!xmtpEnvExists ? `XMTP_ENV=${env}\n` : ""}# public key is ${publicKey}
`;

  // Write the .env file to the example directory
  await writeFile(filePath, envContent, { flag: "a" });
  console.log(`Keys written to ${filePath}`);
  console.log(`Public key: ${publicKey}`);
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
