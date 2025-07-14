/**
 * XMTP SDK Version Manager
 *
 * Manages multiple XMTP SDK versions for compatibility testing.
 * Creates symlinks between SDK and bindings packages to ensure
 * proper version resolution across different SDK versions.
 *
 * Usage: yarn script versions [--clean]
 *
 * Functions:
 *   - Auto-discovers SDK packages in node_modules
 *   - Creates symlinks for proper bindings resolution
 *   - Verifies version compatibility
 *   - Manages package.json imports field
 */

import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { VersionList } from "@workers/versions";

type VersionConfig = (typeof VersionList)[number];
const staticConfigs = VersionList;
/**
 * Auto-discovers SDK and bindings packages in node_modules/@xmtp
 *
 * Scans for versioned packages (e.g., node-sdk-3.1.1, node-bindings-1.2.8)
 * and matches them with their corresponding bindings packages.
 *
 * @returns Array of version configurations including static and discovered packages
 */
function discoverPackages(): VersionConfig[] {
  const configs: VersionConfig[] = [...staticConfigs];
  const rootDir = process.cwd();
  const xmtpDir = path.join(rootDir, "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found in node_modules");
    return configs;
  }

  // Read directory to find SDK and bindings packages
  const entries = fs.readdirSync(xmtpDir);

  // Find SDK packages with a version suffix
  const nodeVersions = entries.filter(
    (entry) => entry.startsWith("node-sdk-") && entry !== "node-sdk", // Skip ones we already have in static config
  );

  // Find bindings packages with a version suffix
  const bindingsPackages = entries.filter(
    (entry) => entry.startsWith("node-bindings-") && entry !== "node-bindings", // Skip ones we already have in static config
  );

  console.log(
    `Found ${nodeVersions.length} SDK packages and ${bindingsPackages.length} bindings packages`,
  );

  // Try to match SDK packages with bindings packages
  for (const nodeVersion of nodeVersions) {
    // Extract version suffix (e.g., "101" from "node-sdk-101")
    const versionSuffix = nodeVersion.replace("node-sdk-", "");

    // Look for a corresponding bindings package
    const matchingBindings = bindingsPackages.find(
      (bp) => bp === `node-bindings-${versionSuffix}`,
    );

    if (matchingBindings) {
      // Try to get actual version from package.json
      let nodeVersion = "";

      try {
        const nodeVersionJson = JSON.parse(
          fs.readFileSync(
            path.join(xmtpDir, nodeVersion, "package.json"),
            "utf8",
          ),
        );
        nodeVersion = nodeVersionJson.version || "";
      } catch (error: unknown) {
        console.error(error);
        nodeVersion = "unknown";
      }

      // try {
      //   const bindingsPackageJson = JSON.parse(
      //     fs.readFileSync(
      //       path.join(xmtpDir, matchingBindings, "package.json"),
      //       "utf8",
      //     ),
      //   );
      //   libXmtpVersion_NOT_NEEDED = bindingsPackageJson.version || "";
      // } catch (error: unknown) {
      //   console.error(error);
      // }

      // For dynamically discovered packages, we can't import the specific types
      // so we'll set them to null or use a placeholder

      configs.push({
        Client: null as any,
        Conversation: null as any,
        Dm: null as any,
        Group: null as any,
        bindingsPackage: matchingBindings,
        nodeVersion,
        auto: false,
      });

      console.log(`${nodeVersion} -> ${matchingBindings}`);
    }
  }

  return configs;
}

/**
 * Creates symlinks for node bindings to ensure proper version resolution
 *
 * Each SDK version needs its own node_modules/@xmtp/node-bindings symlink
 * pointing to the correct bindings package version. This ensures that
 * when an SDK is imported, it uses the correct native bindings.
 *
 * @param configs - Array of version configurations to process
 */
function createBindingsSymlinks(configs: VersionConfig[]) {
  const rootDir = process.cwd();
  const xmtpDir = path.join(rootDir, "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found in node_modules");
    return;
  }

  console.log("Creating bindings symlinks...");

  for (const config of configs) {
    if (!config.bindingsPackage) continue;
    const sdkDir = path.join(xmtpDir, `node-sdk-${config.nodeVersion}`);
    const bindingsDir = path.join(
      xmtpDir,
      `node-bindings-${config.bindingsPackage}`,
    );

    // Verify that the SDK and bindings packages exist
    if (!fs.existsSync(sdkDir)) {
      console.error(`SDK package ${config.nodeVersion} not found`);
      continue;
    }

    if (!fs.existsSync(bindingsDir)) {
      console.error(`Bindings package ${config.bindingsPackage} not found`);
      continue;
    }

    // Create node_modules directory inside the SDK package
    const sdkNodeModulesDir = path.join(sdkDir, "node_modules");
    const sdkNodeModulesXmtpDir = path.join(sdkNodeModulesDir, "@xmtp");
    const symlinkTarget = path.join(sdkNodeModulesXmtpDir, "node-bindings");

    // Remove existing node_modules if it exists
    if (fs.existsSync(sdkNodeModulesDir)) {
      fs.rmSync(sdkNodeModulesDir, { recursive: true, force: true });
    }

    // Create directories
    fs.mkdirSync(sdkNodeModulesDir, { recursive: true });
    fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

    // Create the symbolic link
    try {
      // Calculate relative path for symlink
      const relativeBindingsPath = path.relative(
        sdkNodeModulesXmtpDir,
        bindingsDir,
      );

      fs.symlinkSync(relativeBindingsPath, symlinkTarget);
      console.log(`Linked: ${config.nodeVersion} -> ${config.bindingsPackage}`);

      // Verify the version.json file is accessible
      const versionJsonPath = path.join(symlinkTarget, "dist", "version.json");
      if (fs.existsSync(versionJsonPath)) {
        try {
          const versionData = JSON.parse(
            fs.readFileSync(versionJsonPath, "utf8"),
          );
          console.log(
            `${config.nodeVersion} -> ${config.bindingsPackage} (${versionData.version})`,
          );
        } catch (error: unknown) {
          console.error(error);
          // Silent fail
        }
      }
    } catch (error: unknown) {
      console.error(
        `Error linking ${config.nodeVersion}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Verifies each SDK imports the correct bindings version
 *
 * Checks that each SDK package correctly imports from its
 * corresponding bindings package through the symlinks.
 *
 * @param configs - Array of version configurations to verify
 */
function verifyVersions(configs: VersionConfig[]) {
  const rootDir = process.cwd();
  const xmtpDir = path.join(rootDir, "node_modules", "@xmtp");

  console.log("\nVerifying SDK versions...");

  for (const config of configs) {
    const sdkDir = path.join(xmtpDir, config.nodeVersion);

    // Check if the SDK package imports from bindings directly
    const sdkIndexPath = path.join(sdkDir, "dist", "index.js");
    if (fs.existsSync(sdkIndexPath)) {
      try {
        const sdkContent = fs.readFileSync(sdkIndexPath, "utf8");

        // Check if it imports version.json from node-bindings
        if (sdkContent.includes("@xmtp/node-bindings/version.json")) {
          console.log(`${config.nodeVersion} -> ${config.bindingsPackage}`);
        }
      } catch (error: unknown) {
        console.error(error);
      }
    }
  }
}

/**
 * Cleans up the imports field from package.json
 *
 * Removes the "imports" field that may interfere with
 * proper module resolution during version testing.
 */
function cleanPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    console.error("package.json not found");
    return;
  }

  console.log('Cleaning "imports" field from package.json...');

  try {
    // Read the package.json file
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    // Check if there's an imports field
    if (packageJson.imports) {
      // Remove the imports field
      delete packageJson.imports;

      // Write the updated package.json
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
        "utf8",
      );

      console.log('Removed "imports" field from package.json');
    }
  } catch (error: unknown) {
    console.error(
      `Error processing package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Removes the node_modules folder
 *
 * Clean removal of node_modules to ensure fresh package installation
 * when setting up SDK versions.
 */
function removeNodeModules() {
  const rootDir = process.cwd();
  const nodeModulesDir = path.join(rootDir, "node_modules");

  console.log("Removing node_modules folder...");

  if (fs.existsSync(nodeModulesDir)) {
    try {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
      console.log("node_modules folder removed successfully");
    } catch (error: unknown) {
      console.error(
        `Error removing node_modules: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    console.log("node_modules folder does not exist");
  }
}

/**
 * Runs yarn install to install dependencies
 *
 * Installs all package dependencies after node_modules cleanup.
 */
function runYarnInstall() {
  console.log("Running yarn install...");

  try {
    execSync("yarn install", { stdio: "inherit" });
    console.log("yarn install completed successfully");
  } catch (error: unknown) {
    console.error(
      `Error running yarn install: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Displays help information for the versions command
 */
function showHelp() {
  console.log(`
XMTP SDK Version Manager

Manages multiple XMTP SDK versions for compatibility testing.
Creates symlinks between SDK and bindings packages to ensure
proper version resolution across different SDK versions.

Usage:
  yarn script versions [options]

Options:
  --clean                         Clean package.json imports field before setup
  --help, -h                      Show this help message

Description:
  This tool automatically discovers XMTP SDK packages in node_modules
  and creates the necessary symlinks for proper version resolution.
  
  The tool performs the following operations:
  • Auto-discovers SDK packages in node_modules/@xmtp
  • Creates symlinks for proper bindings resolution
  • Verifies version compatibility
  • Manages package.json imports field (when --clean is used)
  • Removes and reinstalls node_modules (except in CI environments)

Examples:
  yarn script versions            # Standard version setup
  yarn script versions --clean   # Clean imports field and setup versions
  yarn script versions --help    # Show this help message

Notes:
  • In CI environments (GITHUB_ACTIONS=true), node_modules is not removed
  • Symlinks are created to ensure each SDK version uses correct bindings
  • Version compatibility is verified after symlink creation
`);
}

/**
 * Main execution function
 *
 * Orchestrates the SDK version setup process:
 * 1. Optionally cleans package.json imports
 * 2. Removes and reinstalls node_modules (except in CI)
 * 3. Discovers all SDK packages
 * 4. Creates necessary symlinks
 * 5. Verifies version compatibility
 */
function main() {
  console.log("Starting SDK Version Fixer");

  // Check for --clean flag
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    cleanPackageJson();
  }

  // Check for --help flag
  const shouldShowHelp =
    process.argv.includes("--help") || process.argv.includes("-h");
  if (shouldShowHelp) {
    showHelp();
    return;
  }

  if (!process.env.GITHUB_ACTIONS) {
    // Remove node_modules folder
    removeNodeModules();
    // Run yarn install
    runYarnInstall();
  }

  // Discover and process packages
  const configs = discoverPackages();
  createBindingsSymlinks(configs);
  verifyVersions(configs);

  console.log("\nDone");
}

main();
