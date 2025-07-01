import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { VersionList } from "@helpers/client";
import { Client, Conversation, Dm, Group } from "@xmtp/node-sdk";

type VersionConfig = (typeof VersionList)[keyof typeof VersionList];
const staticConfigs = Object.values(VersionList).map((version) => ({
  ...version,
  sdkPackage: version.sdkPackage,
  bindingsPackage: version.bindingsPackage,
}));
/**
 * Auto-discover SDK and bindings packages in node_modules/@xmtp
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
  const sdkPackages = entries.filter(
    (entry) => entry.startsWith("node-sdk-") && entry !== "node-sdk-100", // Skip ones we already have in static config
  );

  // Find bindings packages with a version suffix
  const bindingsPackages = entries.filter(
    (entry) =>
      entry.startsWith("node-bindings-") && entry !== "node-bindings-100", // Skip ones we already have in static config
  );

  console.log(
    `Found ${sdkPackages.length} SDK packages and ${bindingsPackages.length} bindings packages`,
  );

  // Try to match SDK packages with bindings packages
  for (const sdkPackage of sdkPackages) {
    // Extract version suffix (e.g., "101" from "node-sdk-101")
    const versionSuffix = sdkPackage.replace("node-sdk-", "");

    // Look for a corresponding bindings package
    const matchingBindings = bindingsPackages.find(
      (bp) => bp === `node-bindings-${versionSuffix}`,
    );

    if (matchingBindings) {
      // Try to get actual version from package.json
      let nodeVersion = "";
      let libXmtpVersion = "";

      try {
        const sdkPackageJson = JSON.parse(
          fs.readFileSync(
            path.join(xmtpDir, sdkPackage, "package.json"),
            "utf8",
          ),
        );
        nodeVersion = sdkPackageJson.version || "";
      } catch (error: unknown) {
        console.error(error);
        nodeVersion = "unknown";
      }

      try {
        const bindingsPackageJson = JSON.parse(
          fs.readFileSync(
            path.join(xmtpDir, matchingBindings, "package.json"),
            "utf8",
          ),
        );
        libXmtpVersion = bindingsPackageJson.version || "";
      } catch (error: unknown) {
        console.error(error);
        libXmtpVersion = "unknown";
      }

      // For dynamically discovered packages, we can't import the specific types
      // so we'll set them to null or use a placeholder
      configs.push({
        sdkPackage,
        bindingsPackage: matchingBindings,
        nodeVersion,
        libXmtpVersion,
        Client: null as any,
        Conversation: null as any,
        Dm: null as any,
        Group: null as any,
      });

      console.log(`${sdkPackage} -> ${matchingBindings}`);
    } else {
      console.log(`${sdkPackage} -> no matching bindings`);
    }
  }

  return configs;
}

/**
 * Create symlinks for node bindings to ensure proper version resolution
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
    const sdkDir = path.join(xmtpDir, config.sdkPackage);
    const bindingsDir = path.join(xmtpDir, config.bindingsPackage);

    // Verify that the SDK and bindings packages exist
    if (!fs.existsSync(sdkDir)) {
      console.error(`SDK package ${config.sdkPackage} not found`);
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
      console.log(`Linked: ${config.sdkPackage} -> ${config.bindingsPackage}`);

      // Verify the version.json file is accessible
      const versionJsonPath = path.join(symlinkTarget, "dist", "version.json");
      if (fs.existsSync(versionJsonPath)) {
        try {
          const versionData = JSON.parse(
            fs.readFileSync(versionJsonPath, "utf8"),
          );
          console.log(
            `${config.sdkPackage} -> ${config.bindingsPackage} (${versionData.version})`,
          );
        } catch (error: unknown) {
          console.error(error);
          // Silent fail
        }
      }
    } catch (error: unknown) {
      console.error(
        `Error linking ${config.sdkPackage}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Verify each SDK imports the correct version
 */
function verifyVersions(configs: VersionConfig[]) {
  const rootDir = process.cwd();
  const xmtpDir = path.join(rootDir, "node_modules", "@xmtp");

  console.log("\nVerifying SDK versions...");

  for (const config of configs) {
    const sdkDir = path.join(xmtpDir, config.sdkPackage);

    // Check if the SDK package imports from bindings directly
    const sdkIndexPath = path.join(sdkDir, "dist", "index.js");
    if (fs.existsSync(sdkIndexPath)) {
      try {
        const sdkContent = fs.readFileSync(sdkIndexPath, "utf8");

        // Check if it imports version.json from node-bindings
        if (sdkContent.includes("@xmtp/node-bindings/version.json")) {
          console.log(`${config.sdkPackage} -> ${config.bindingsPackage}`);
        }
      } catch (error: unknown) {
        console.error(error);
      }
    }
  }
}

/**
 * Clean up the imports field from package.json
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
 * Remove the node_modules folder
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
 * Run yarn install
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

// Main function
function main() {
  console.log("Starting SDK Version Fixer");

  // Check for --clean flag
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    cleanPackageJson();
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
