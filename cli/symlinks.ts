import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { AgentVersionList, VersionList } from "@helpers/versions";

function showHelp() {
  console.log(`
XMTP Versions CLI - SDK and Agent SDK version management and setup

USAGE:
  yarn symlinks [options]

OPTIONS:
  --clean               Clean package.json imports and node_modules before setup
  -h, --help            Show this help message

DESCRIPTION:
  Sets up SDK version testing by creating symlinks for different XMTP SDK versions
  and Agent SDK versions. This enables testing across multiple SDK versions
  simultaneously.

  - Creates bindings symlinks for node-sdk versions
  - Creates node-sdk symlinks for agent-sdk versions

EXAMPLES:
  yarn symlinks
  yarn symlinks --clean
  yarn symlinks --help

For more information, see: cli/README.md
`);
}

function createBindingsSymlinks() {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found");
    process.exit(1);
  }

  console.log("Creating bindings symlinks...");
  console.log("  (Linking node-sdk versions to their required bindings)");

  let hasErrors = false;

  for (const config of VersionList) {
    if (!config.nodeSDK) continue;

    const sdkDir = path.join(xmtpDir, `node-sdk-${config.nodeSDK}`);
    const bindingsDir = path.join(
      xmtpDir,
      `node-bindings-${config.nodeBindings}`,
    );

    if (!fs.existsSync(sdkDir)) {
      console.error(
        `❌ SDK directory not found: ${config.nodeSDK} (${sdkDir})`,
      );
      hasErrors = true;
      continue;
    }

    if (!fs.existsSync(bindingsDir)) {
      console.error(
        `❌ Bindings directory not found: ${config.nodeBindings} (${bindingsDir})`,
      );
      hasErrors = true;
      continue;
    }

    const sdkNodeModulesXmtpDir = path.join(sdkDir, "node_modules", "@xmtp");
    const symlinkTarget = path.join(sdkNodeModulesXmtpDir, "node-bindings");

    // Check if symlink already exists and points to correct target
    let needsUpdate = true;
    if (fs.existsSync(symlinkTarget)) {
      try {
        const stats = fs.lstatSync(symlinkTarget);
        if (stats.isSymbolicLink()) {
          const currentTarget = fs.readlinkSync(symlinkTarget);
          const expectedRelativePath = path.relative(
            sdkNodeModulesXmtpDir,
            bindingsDir,
          );
          // Normalize paths for comparison
          if (
            path.resolve(sdkNodeModulesXmtpDir, currentTarget) ===
            path.resolve(sdkNodeModulesXmtpDir, expectedRelativePath)
          ) {
            needsUpdate = false;
          }
        }
      } catch {
        // If we can't read the symlink, we'll recreate it
      }
    }

    if (needsUpdate) {
      // Remove existing node_modules/@xmtp directory if it exists
      if (fs.existsSync(sdkNodeModulesXmtpDir)) {
        try {
          // Only remove the symlink, not the entire directory
          if (fs.existsSync(symlinkTarget)) {
            const stats = fs.lstatSync(symlinkTarget);
            if (stats.isSymbolicLink()) {
              fs.unlinkSync(symlinkTarget);
            } else {
              fs.rmSync(symlinkTarget, { recursive: true, force: true });
            }
          }
          // Remove parent directories if empty
          if (fs.existsSync(sdkNodeModulesXmtpDir)) {
            try {
              fs.rmdirSync(sdkNodeModulesXmtpDir);
            } catch {
              // Directory not empty, that's fine
            }
          }
        } catch {
          // If removal fails, try removing the entire node_modules
          if (fs.existsSync(path.join(sdkDir, "node_modules"))) {
            fs.rmSync(path.join(sdkDir, "node_modules"), {
              recursive: true,
              force: true,
            });
          }
        }
      }

      // Create directories and symlink
      fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

      try {
        const relativeBindingsPath = path.relative(
          sdkNodeModulesXmtpDir,
          bindingsDir,
        );
        fs.symlinkSync(relativeBindingsPath, symlinkTarget);
        console.log(
          `✅ node-sdk-${config.nodeSDK} → node-bindings-${config.nodeBindings}`,
        );
      } catch (error) {
        console.error(
          `❌ Error linking node-sdk-${config.nodeSDK} to node-bindings-${config.nodeBindings}: ${String(error)}`,
        );
        hasErrors = true;
      }
    } else {
      console.log(
        `⏭️  node-sdk-${config.nodeSDK} → node-bindings-${config.nodeBindings} (already linked)`,
      );
    }
  }

  if (hasErrors) {
    console.error("❌ Failed to create all required bindings symlinks");
    process.exit(1);
  }

  console.log("✅ Node SDK bindings setup complete!");
}

function createAgentSDKSymlinks() {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found");
    process.exit(1);
  }

  console.log("Creating Agent SDK symlinks...");
  console.log(
    "  (Linking agent-sdk versions to their required node-sdk versions)",
  );

  let hasErrors = false;

  for (const config of AgentVersionList) {
    if (!config.agentSDK || !config.nodeSDK) continue;

    const agentSDKDir = path.join(xmtpDir, `agent-sdk-${config.agentSDK}`);
    const nodeSDKDir = path.join(xmtpDir, `node-sdk-${config.nodeSDK}`);

    if (!fs.existsSync(agentSDKDir)) {
      console.error(
        `❌ Agent SDK directory not found: ${config.agentSDK} (${agentSDKDir})`,
      );
      hasErrors = true;
      continue;
    }

    if (!fs.existsSync(nodeSDKDir)) {
      console.error(
        `❌ Node SDK directory not found: ${config.nodeSDK} (${nodeSDKDir})`,
      );
      hasErrors = true;
      continue;
    }

    const agentSDKNodeModulesXmtpDir = path.join(
      agentSDKDir,
      "node_modules",
      "@xmtp",
    );
    const symlinkTarget = path.join(agentSDKNodeModulesXmtpDir, "node-sdk");

    // Check if symlink already exists and points to correct target
    let needsUpdate = true;
    if (fs.existsSync(symlinkTarget)) {
      try {
        const stats = fs.lstatSync(symlinkTarget);
        if (stats.isSymbolicLink()) {
          const currentTarget = fs.readlinkSync(symlinkTarget);
          const expectedRelativePath = path.relative(
            agentSDKNodeModulesXmtpDir,
            nodeSDKDir,
          );
          // Normalize paths for comparison
          if (
            path.resolve(agentSDKNodeModulesXmtpDir, currentTarget) ===
            path.resolve(agentSDKNodeModulesXmtpDir, expectedRelativePath)
          ) {
            needsUpdate = false;
          }
        }
      } catch {
        // If we can't read the symlink, we'll recreate it
      }
    }

    if (needsUpdate) {
      // Remove existing node_modules/@xmtp directory if it exists
      if (fs.existsSync(agentSDKNodeModulesXmtpDir)) {
        try {
          // Only remove the symlink, not the entire directory
          if (fs.existsSync(symlinkTarget)) {
            const stats = fs.lstatSync(symlinkTarget);
            if (stats.isSymbolicLink()) {
              fs.unlinkSync(symlinkTarget);
            } else {
              fs.rmSync(symlinkTarget, { recursive: true, force: true });
            }
          }
          // Remove parent directories if empty
          if (fs.existsSync(agentSDKNodeModulesXmtpDir)) {
            try {
              fs.rmdirSync(agentSDKNodeModulesXmtpDir);
            } catch {
              // Directory not empty, that's fine
            }
          }
        } catch {
          // If removal fails, try removing the entire node_modules
          if (fs.existsSync(path.join(agentSDKDir, "node_modules"))) {
            fs.rmSync(path.join(agentSDKDir, "node_modules"), {
              recursive: true,
              force: true,
            });
          }
        }
      }

      // Create directories and symlink
      fs.mkdirSync(agentSDKNodeModulesXmtpDir, { recursive: true });

      try {
        const relativeNodeSDKPath = path.relative(
          agentSDKNodeModulesXmtpDir,
          nodeSDKDir,
        );
        fs.symlinkSync(relativeNodeSDKPath, symlinkTarget);
        console.log(
          `✅ agent-sdk-${config.agentSDK} → node-sdk-${config.nodeSDK}`,
        );
      } catch (error) {
        console.error(
          `❌ Error linking agent-sdk-${config.agentSDK} to node-sdk-${config.nodeSDK}: ${String(error)}`,
        );
        hasErrors = true;
      }
    } else {
      console.log(
        `⏭️  agent-sdk-${config.agentSDK} → node-sdk-${config.nodeSDK} (already linked)`,
      );
    }
  }

  if (hasErrors) {
    console.error("❌ Failed to create all required Agent SDK symlinks");
    process.exit(1);
  }

  console.log("✅ Agent SDK version setup complete!");
}

function cleanPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) return;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    if (packageJson.imports) {
      delete packageJson.imports;
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
      );
      console.log('Removed "imports" field from package.json');
    }
  } catch (error) {
    console.error(`Error processing package.json: ${String(error)}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const shouldClean = args.includes("--clean");

  if (shouldClean) {
    cleanPackageJson();
    if (!process.env.GITHUB_ACTIONS) {
      const nodeModulesDir = path.join(process.cwd(), "node_modules");
      if (fs.existsSync(nodeModulesDir)) {
        try {
          fs.rmSync(nodeModulesDir, { recursive: true, force: true });
        } catch (error) {
          console.warn(
            `Warning: Could not remove node_modules directory: ${String(error)}`,
          );
          console.log("Continuing with existing node_modules...");
        }
      }
      try {
        execSync("yarn install", { stdio: "inherit" });
      } catch (error) {
        console.warn(`Warning: Could not run yarn install: ${String(error)}`);
        console.log("Continuing with existing installation...");
      }
    }
  }

  // Always run both operations
  createBindingsSymlinks();
  createAgentSDKSymlinks();
  console.log("✅ All version setup complete!");
  console.log("Done");
}

main();
