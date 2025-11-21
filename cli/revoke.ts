#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSigner } from "@helpers/client";
import { Client, type XmtpEnv } from "@helpers/versions";

function showHelp() {
  console.log(`
XMTP Revoke CLI - Revoke XMTP installations for an inbox

USAGE:
  yarn revoke <inbox-id> [options]

ARGUMENTS:
  inbox-id               64-character hex inbox ID (required)

OPTIONS:
  --keep <ids>           Comma-separated installation IDs to keep (optional)
  --env <environment>    Override XMTP environment from .env file
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network
  production  Production XMTP network

DESCRIPTION:
  Revokes XMTP installations for a given inbox ID. You can specify which
  installations to keep, or omit this to keep only the current installation.

  This command reads wallet keys and environment from a .env file in the
  current directory. Run 'yarn gen:keys' first to generate keys.

EXAMPLES:
  # Revoke all installations except current
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

  # Keep specific installations
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --keep "installation-id1,installation-id2"

  # Override environment
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --env production
  yarn revoke --help

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

  // Parse arguments
  let inboxId = "";
  let installationsToKeep: string[] = [];
  let envOverride: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--keep" && nextArg) {
      installationsToKeep = nextArg
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      i++;
    } else if (arg === "--env" && nextArg) {
      envOverride = nextArg;
      i++;
    } else if (!arg.startsWith("--") && !inboxId) {
      // First non-flag argument is the inbox ID
      inboxId = arg;
    }
  }

  if (!inboxId) {
    console.error("Error: Inbox ID is required as a command line argument");
    console.error("Usage: yarn revoke <inbox-id> [--keep <ids>]");
    console.error(
      'Example: yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --keep "installation-id1,installation-id2"',
    );
    process.exit(1);
  }

  // Validate inbox ID format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(inboxId)) {
    console.error(
      "Error: Invalid inbox ID format. Must be 64 hexadecimal characters.",
    );
    console.error(`Provided: ${inboxId}`);
    process.exit(1);
  }

  // Validate installation IDs if provided
  if (installationsToKeep.length > 0) {
    const invalidInstallations = installationsToKeep.filter(
      (id) => !/^[a-f0-9]{64}$/i.test(id),
    );
    if (invalidInstallations.length > 0) {
      console.error(
        "Error: Invalid installation ID format(s). Must be 64 hexadecimal characters.",
      );
      console.error("Invalid IDs:", invalidInstallations.join(", "));
      console.error(
        "Usage: Provide installation IDs separated by commas, or omit to keep only current installation.",
      );
      console.error(
        'Example: yarn revoke <inbox-id> --keep "installation-id1,installation-id2"',
      );
      process.exit(1);
    }
  }

  // Get the current working directory (should be the example directory)
  const exampleDir = process.cwd();
  const exampleName = exampleDir.split("/").pop() || "example";
  const envPath = join(exampleDir, ".env");

  console.log(`Looking for .env file in: ${exampleDir}`);

  // Check if .env file exists
  if (!existsSync(envPath)) {
    console.error(
      "Error: .env file not found. Please run 'yarn gen:keys' first to generate keys.",
    );
    process.exit(1);
  }

  // Sanitize environment variable value by removing surrounding quotes
  const sanitizeEnvValue = (value: string): string => {
    const trimmed = value.trim();
    // Remove surrounding quotes (single or double) if present
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };

  // Read and parse .env file
  const envContent = await readFile(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !key.startsWith("#")) {
      envVars[key.trim()] = sanitizeEnvValue(value);
    }
  });

  // Use env override if provided, otherwise use .env file value
  const env = envOverride || envVars.XMTP_ENV;
  if (!env) {
    console.error(
      "Error: XMTP_ENV not found in .env file and --env not provided.",
    );
    console.error("Please run 'yarn gen:keys' first or provide --env flag.");
    process.exit(1);
  }

  if (!envVars.XMTP_WALLET_KEY || !envVars.XMTP_DB_ENCRYPTION_KEY) {
    const missingVars: string[] = [];
    if (!envVars.XMTP_WALLET_KEY) missingVars.push("XMTP_WALLET_KEY");
    if (!envVars.XMTP_DB_ENCRYPTION_KEY) missingVars.push("XMTP_DB_ENCRYPTION_KEY");
    console.error(
      `Error: Missing required environment variables: ${missingVars.join(", ")}`,
    );
    console.error("Please run 'yarn gen:keys' first to generate keys.");
    process.exit(1);
  }

  console.log(`Revoking installations for ${exampleName}...`);
  console.log(`Inbox ID: ${inboxId}`);
  console.log(`Environment: ${env}`);
  if (installationsToKeep.length > 0) {
    console.log(`Installations to keep: ${installationsToKeep.join(", ")}`);
  } else {
    console.log(`Installations to keep: current installation only`);
  }

  try {
    // Create signer and encryption key
    const signer = createSigner(envVars.XMTP_WALLET_KEY);

    // Get current inbox state
    const inboxState = await Client.inboxStateFromInboxIds(
      [inboxId],
      env as unknown as XmtpEnv,
    );

    const currentInstallations = inboxState[0].installations;
    console.log(`✓ Current installations: ${currentInstallations.length}`);

    // If there's only 1 installation, it's the current one - don't revoke anything
    if (currentInstallations.length === 1) {
      console.log(
        `✓ Only 1 installation found - this is the current one, nothing to revoke`,
      );
      return;
    }

    // Determine which installations to keep
    let installationsToKeepIds: string[];

    if (installationsToKeep.length > 0) {
      // Use provided installation IDs
      installationsToKeepIds = installationsToKeep;

      // Validate that all specified installations actually exist
      const existingInstallationIds = currentInstallations.map(
        (inst) => inst.id,
      );
      const nonExistentInstallations = installationsToKeepIds.filter(
        (id) => !existingInstallationIds.includes(id),
      );

      if (nonExistentInstallations.length > 0) {
        console.error("Error: Some specified installation IDs do not exist:");
        console.error("Non-existent IDs:", nonExistentInstallations.join(", "));
        console.error(
          "Available installation IDs:",
          existingInstallationIds.join(", "),
        );
        process.exit(1);
      }
    } else {
      // No installations specified - ask for confirmation to revoke all except current
      console.log("\n⚠️  No installations specified to keep.");
      console.log("Available installation IDs:");
      currentInstallations.forEach((inst, index) => {
        console.log(`  ${index + 1}. ${inst.id}`);
      });

      console.log(
        `\nThis will revoke ALL ${currentInstallations.length - 1} installations except one (which will be kept as the current installation).`,
      );

      // Get user confirmation
      process.stdout.write("\nDo you want to proceed? (y/N): ");

      const confirmation = await new Promise<string>((resolve) => {
        process.stdin.once("data", (data) => {
          resolve(data.toString().trim().toLowerCase());
        });
      });

      if (confirmation !== "y" && confirmation !== "yes") {
        console.log("Operation cancelled.");
        process.exit(0);
      }

      // Keep the first installation (arbitrary choice since user didn't specify)
      installationsToKeepIds = [currentInstallations[0].id];
      console.log(`✓ Keeping installation: ${installationsToKeepIds[0]}`);
    }

    // Find installations to revoke (all except the ones to keep)
    const installationsToRevoke = currentInstallations.filter(
      (installation) => !installationsToKeepIds.includes(installation.id),
    );

    console.log(
      `Available for revocation: ${installationsToRevoke.length} (keeping ${installationsToKeepIds.length})`,
    );

    // Safety check: if no installations are available for revocation, don't proceed
    if (installationsToRevoke.length === 0) {
      console.log(
        `✓ No installations to revoke - all specified installations are already kept`,
      );
      return;
    }

    // Safety check: ensure at least 1 installation remains after revocation
    const remainingInstallations =
      currentInstallations.length - installationsToRevoke.length;
    if (remainingInstallations === 0) {
      console.error(
        "Error: Cannot revoke all installations. At least 1 installation must remain.",
      );
      console.error("Current installations:", currentInstallations.length);
      console.error("Installations to revoke:", installationsToRevoke.length);
      console.error("Please specify at least 1 installation to keep.");
      process.exit(1);
    }

    // Revoke the installations
    const installationsToRevokeBytes = installationsToRevoke.map(
      (installation) => installation.bytes,
    );

    console.log(`Revoking ${installationsToRevoke.length} installations...`);

    await Client.revokeInstallations(
      signer,
      inboxId,
      installationsToRevokeBytes,
      env as unknown as XmtpEnv,
    );

    console.log(`✓ Revoked ${installationsToRevoke.length} installations`);

    // Get final state to confirm
    const finalInboxState = await Client.inboxStateFromInboxIds(
      [inboxId],
      env as unknown as XmtpEnv,
    );
    console.log(
      `✓ Final installations: ${finalInboxState[0].installations.length}`,
    );
    process.exit(0);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error revoking installations:", errorMessage);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

