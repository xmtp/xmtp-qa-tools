import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSigner } from "@helpers/client";
import { Client, type XmtpEnv } from "version-management/client-versions";

// Check Node.js version
const nodeSDK = process.versions.node;
const [major] = nodeSDK.split(".").map(Number);
if (major < 20) {
  console.error("Error: Node.js version 20 or higher is required");
  process.exit(1);
}

function showHelp() {
  console.log(`
XMTP Revoke CLI - Installation revocation management

USAGE:
  yarn revoke <inbox-id> [installations-to-save]

ARGUMENTS:
  inbox-id               64-character hexadecimal inbox ID
  installations-to-save  Comma-separated installation IDs to keep (optional)

OPTIONS:
  -h, --help            Show this help message

DESCRIPTION:
  Revokes all installations for a given inbox except those specified
  in installations-to-save. If no installations are specified, only
  the current installation is kept.

EXAMPLES:
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 "current-installation-id,another-installation-id"
  yarn revoke --help

REQUIREMENTS:
  - Node.js version 20 or higher
  - .env file with WALLET_KEY, ENCRYPTION_KEY, and XMTP_ENV

For more information, see: cli/readme.md
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Get inbox ID and installations to save from command line arguments
  const inboxId = args[0];
  const installationsToSave = args[1];

  if (!inboxId) {
    console.error("Error: Inbox ID is required as a command line argument");
    console.error("Usage: yarn revoke <inbox-id> [installations-to-save]");
    console.error("Run 'yarn revoke --help' for more information");
    process.exit(1);
  }

  // Validate inbox ID format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(inboxId)) {
    console.error(
      "Error: Invalid inbox ID format. Must be 64 hexadecimal characters.",
    );
    console.error(`Provided: ${inboxId}`);
    console.error("Run 'yarn revoke --help' for more information");
    process.exit(1);
  }

  // Parse installations to save, default to current installation if not provided
  const installationsToKeep = installationsToSave
    ? installationsToSave
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

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
      console.error("Run 'yarn revoke --help' for more information");
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

  // Read and parse .env file
  const envContent = await readFile(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !key.startsWith("#")) {
      envVars[key.trim()] = value.trim();
    }
  });

  // Validate required environment variables
  const requiredVars = ["WALLET_KEY", "ENCRYPTION_KEY", "XMTP_ENV"];
  const missingVars = requiredVars.filter((varName) => !envVars[varName]);

  if (missingVars.length > 0) {
    console.error(
      `Error: Missing required environment variables: ${missingVars.join(", ")}`,
    );
    console.error("Please run 'yarn gen:keys' to generate the required keys.");
    process.exit(1);
  }

  console.log(`Revoking installations for ${exampleName}...`);
  console.log(`Inbox ID: ${inboxId}`);
  console.log(`Environment: ${envVars.XMTP_ENV}`);
  if (installationsToKeep.length > 0) {
    console.log(`Installations to keep: ${installationsToKeep.join(", ")}`);
  } else {
    console.log(`Installations to keep: current installation only`);
  }

  try {
    // Create signer and encryption key
    const signer = createSigner(envVars.WALLET_KEY as `0x${string}`);

    // Get current inbox state
    const inboxState = await Client.inboxStateFromInboxIds(
      [inboxId],
      envVars.XMTP_ENV as XmtpEnv,
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
      envVars.XMTP_ENV as XmtpEnv,
    );

    console.log(`✓ Revoked ${installationsToRevoke.length} installations`);

    // Get final state to confirm
    const finalInboxState = await Client.inboxStateFromInboxIds(
      [inboxId],
      envVars.XMTP_ENV as XmtpEnv,
    );
    console.log(
      `✓ Final installations: ${finalInboxState[0].installations.length}`,
    );
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
