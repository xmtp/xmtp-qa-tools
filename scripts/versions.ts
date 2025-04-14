import fs from "fs";
import path from "path";

// Configuration for SDK versions and their corresponding bindings
interface VersionConfig {
  sdkPackage: string; // SDK package name (in node_modules/@xmtp/)
  bindingsPackage: string; // Bindings package name (in node_modules/@xmtp/)
  sdkVersion: string; // SDK version
  bindingsVersion: string; // Bindings version
}

// Static configuration
const staticConfigs: VersionConfig[] = [
  {
    sdkPackage: "node-sdk-mls",
    bindingsPackage: "node-bindings-mls",
    sdkVersion: "0.0.13",
    bindingsVersion: "0.0.9",
  },
  {
    sdkPackage: "node-sdk-47",
    bindingsPackage: "node-bindings-41",
    sdkVersion: "0.0.47",
    bindingsVersion: "0.0.41",
  },
  {
    sdkPackage: "node-sdk-100",
    bindingsPackage: "node-bindings-100",
    sdkVersion: "1.0.0",
    bindingsVersion: "1.0.0",
  },
  {
    sdkPackage: "node-sdk-105",
    bindingsPackage: "node-bindings-105",
    sdkVersion: "1.0.5",
    bindingsVersion: "1.1.3",
  },
  {
    sdkPackage: "node-sdk-200",
    bindingsPackage: "node-bindings-200",
    sdkVersion: "2.0.0",
    bindingsVersion: "1.2.0-dev.bed98df",
  },
];

/**
 * Auto-discover SDK and bindings packages in node_modules/@xmtp
 */
function discoverPackages(): VersionConfig[] {
  const configs: VersionConfig[] = [...staticConfigs];
  const rootDir = process.cwd();
  const xmtpDir = path.join(rootDir, "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("❌ @xmtp directory not found in node_modules");
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
    `🔍 Found ${sdkPackages.length} additional SDK packages and ${bindingsPackages.length} bindings packages`,
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
      let sdkVersion = "";
      let bindingsVersion = "";

      try {
        const sdkPackageJson = JSON.parse(
          fs.readFileSync(
            path.join(xmtpDir, sdkPackage, "package.json"),
            "utf8",
          ),
        );
        sdkVersion = sdkPackageJson.version || "";
      } catch (error: unknown) {
        console.error(error);
        console.warn(
          `⚠️  Could not read version from ${sdkPackage}/package.json`,
        );
      }

      try {
        const bindingsPackageJson = JSON.parse(
          fs.readFileSync(
            path.join(xmtpDir, matchingBindings, "package.json"),
            "utf8",
          ),
        );
        bindingsVersion = bindingsPackageJson.version || "";
      } catch (error: unknown) {
        console.error(error);
        console.warn(
          `⚠️  Could not read version from ${matchingBindings}/package.json`,
        );
      }

      configs.push({
        sdkPackage,
        bindingsPackage: matchingBindings,
        sdkVersion,
        bindingsVersion,
      });

      console.log(
        `✅ Added auto-discovered config for ${sdkPackage} -> ${matchingBindings}`,
      );
    } else {
      console.warn(
        `⚠️  Found SDK package ${sdkPackage} but no matching bindings package`,
      );
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
    console.error("❌ @xmtp directory not found in node_modules");
    return;
  }

  console.log("🛠️  Creating bindings symlinks for SDK versions...");

  for (const config of configs) {
    const sdkDir = path.join(xmtpDir, config.sdkPackage);
    const bindingsDir = path.join(xmtpDir, config.bindingsPackage);

    // Verify that the SDK and bindings packages exist
    if (!fs.existsSync(sdkDir)) {
      console.error(`❌ SDK package ${config.sdkPackage} not found`);
      continue;
    }

    if (!fs.existsSync(bindingsDir)) {
      console.error(`❌ Bindings package ${config.bindingsPackage} not found`);
      continue;
    }

    // Create node_modules directory inside the SDK package
    const sdkNodeModulesDir = path.join(sdkDir, "node_modules");
    const sdkNodeModulesXmtpDir = path.join(sdkNodeModulesDir, "@xmtp");
    const symlinkTarget = path.join(sdkNodeModulesXmtpDir, "node-bindings");

    // Remove existing node_modules if it exists
    if (fs.existsSync(sdkNodeModulesDir)) {
      console.log(
        `🧹 Cleaning up existing node_modules in ${config.sdkPackage}`,
      );
      try {
        fs.rmSync(sdkNodeModulesDir, { recursive: true, force: true });
      } catch (error: unknown) {
        console.error(
          `❌ Error removing directory: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
    }

    // Create directories
    console.log(
      `📁 Creating node_modules directories for ${config.sdkPackage}`,
    );
    fs.mkdirSync(sdkNodeModulesDir, { recursive: true });
    fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

    // Create the symbolic link
    try {
      console.log(
        `🔗 Creating symlink: ${config.bindingsPackage} -> node-bindings for ${config.sdkPackage}`,
      );
      // Calculate relative path for symlink
      const relativeBindingsPath = path.relative(
        sdkNodeModulesXmtpDir,
        bindingsDir,
      );

      fs.symlinkSync(relativeBindingsPath, symlinkTarget);
      console.log(`✅ Successfully created symlink for ${config.sdkPackage}`);

      // Verify the version.json file is accessible
      const versionJsonPath = path.join(symlinkTarget, "dist", "version.json");
      if (fs.existsSync(versionJsonPath)) {
        try {
          const versionData = JSON.parse(
            fs.readFileSync(versionJsonPath, "utf8"),
          );
          console.log(
            `📊 ${config.sdkPackage} -> ${config.bindingsPackage} version: ${versionData.branch}@${versionData.version}`,
          );
        } catch (error: unknown) {
          console.warn(
            `⚠️  Error reading version.json: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(
          `⚠️  Warning: version.json not found at ${versionJsonPath}`,
        );
      }
    } catch (error: unknown) {
      console.error(
        `❌ Error creating symlink: ${error instanceof Error ? error.message : String(error)}`,
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

  console.log("\n🔍 Verifying SDK versions...");

  for (const config of configs) {
    const sdkDir = path.join(xmtpDir, config.sdkPackage);

    // Check if the SDK package imports from bindings directly
    const sdkIndexPath = path.join(sdkDir, "dist", "index.js");
    if (fs.existsSync(sdkIndexPath)) {
      try {
        const sdkContent = fs.readFileSync(sdkIndexPath, "utf8");

        // Check if it imports version.json from node-bindings
        if (sdkContent.includes("@xmtp/node-bindings/version.json")) {
          console.log(
            `ℹ️  ${config.sdkPackage} imports version from @xmtp/node-bindings/version.json`,
          );

          // This should now be redirected via our symlink
          console.log(
            `✅ Symlink should correctly redirect to ${config.bindingsPackage}`,
          );
        } else {
          console.log(
            `ℹ️  ${config.sdkPackage} doesn't directly import version from node-bindings`,
          );
        }
      } catch (error: unknown) {
        console.error(
          `❌ Error reading SDK index file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      console.warn(`⚠️  SDK index file not found for ${config.sdkPackage}`);
    }
  }
}

/**
 * Clean up the imports field from package.json
 */
function cleanPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    console.error("❌ package.json not found");
    return;
  }

  console.log('🧹 Cleaning "imports" field from package.json...');

  try {
    // Read the package.json file
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    // Check if there's an imports field
    if (packageJson.imports) {
      console.log('📝 Found "imports" field in package.json');

      // Remove the imports field
      delete packageJson.imports;

      // Write the updated package.json
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
        "utf8",
      );

      console.log('✅ Successfully removed "imports" field from package.json');
    } else {
      console.log('ℹ️  No "imports" field found in package.json');
    }
  } catch (error: unknown) {
    console.error(
      `❌ Error processing package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Main function
function main() {
  console.log("🚀 Starting SDK Version Fixer");

  // Check for --clean flag
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    cleanPackageJson();
  }

  // Discover and process packages
  const configs = discoverPackages();
  createBindingsSymlinks(configs);
  verifyVersions(configs);

  console.log("\n✅ Done");
}

main();
