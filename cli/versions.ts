import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Static symlink config so we can create node-sdk → node-bindings symlinks
 * without importing @helpers/versions (which would load node-sdk-5.0.0 before
 * symlinks exist). Keep in sync with helpers/versions.ts VersionList.
 */
const SYMLINK_NODE_BINDINGS: { nodeSDK: string; nodeBindings: string }[] = [
  { nodeSDK: "5.0.0", nodeBindings: "1.9.1" },
  { nodeSDK: "5.0.0", nodeBindings: "1.9.1" },
  { nodeSDK: "4.6.0", nodeBindings: "1.6.0" },
  { nodeSDK: "4.5.0", nodeBindings: "1.6.0" },
  { nodeSDK: "4.4.0", nodeBindings: "1.5.0" },
  { nodeSDK: "4.3.0", nodeBindings: "1.4.0" },
];

/**
 * Static symlink config for agent-sdk → node-sdk. Keep in sync with agents/versions.ts AgentVersionList.
 */
const SYMLINK_AGENT_SDK: { agentSDK: string; nodeSDK: string }[] = [
  { agentSDK: "2.2.0", nodeSDK: "5.0.0" },
  { agentSDK: "1.2.0", nodeSDK: "4.6.0" },
  { agentSDK: "1.1.0", nodeSDK: "4.4.0" },
];

function showHelp() {
  console.log(`
XMTP Versions CLI - SDK and Agent SDK version management and setup

USAGE:
  yarn symlinks [options]

OPTIONS:
  --clean               Clean package.json imports and node_modules before setup
  --agentSDK <version>  Link a custom agent-sdk version to a node-sdk
  --nodeSDK <version>   Specify the node-sdk version for custom linking
  --nodeBindings <ver>  Specify the node-bindings version for custom linking
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

type CliOptions = {
  clean: boolean;
  agentSDK?: string;
  nodeSDK?: string;
  nodeBindings?: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    clean: false,
  };

  const getValue = (
    arg: string,
    nextValue: string | undefined,
    flag: string,
  ): { value: string; consumedNext: boolean } => {
    if (arg.includes("=")) {
      const [, rawValue] = arg.split("=", 2);
      if (!rawValue) {
        console.error(`Missing value for ${flag}`);
        process.exit(1);
      }
      return { value: rawValue, consumedNext: false };
    }

    if (nextValue && !nextValue.startsWith("--")) {
      return { value: nextValue, consumedNext: true };
    }

    console.error(`Missing value for ${flag}`);
    process.exit(1);
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    switch (true) {
      case arg === "--clean":
        options.clean = true;
        break;
      case arg.startsWith("--agentSDK"): {
        const { value, consumedNext } = getValue(arg, next, "--agentSDK");
        options.agentSDK = value;
        if (consumedNext) i += 1;
        break;
      }
      case arg.startsWith("--nodeSDK"): {
        const { value, consumedNext } = getValue(arg, next, "--nodeSDK");
        options.nodeSDK = value;
        if (consumedNext) i += 1;
        break;
      }
      case arg.startsWith("--nodeBindings"): {
        const { value, consumedNext } = getValue(arg, next, "--nodeBindings");
        options.nodeBindings = value;
        if (consumedNext) i += 1;
        break;
      }
      default:
        break;
    }
  }

  return options;
}

function linkNodeSDKToBindings(nodeSDK: string, nodeBindings: string): boolean {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  const sdkDir = path.join(xmtpDir, `node-sdk-${nodeSDK}`);
  const bindingsDir = path.join(xmtpDir, `node-bindings-${nodeBindings}`);

  if (!fs.existsSync(sdkDir)) {
    console.error(`❌ SDK directory not found: ${nodeSDK} (${sdkDir})`);
    return false;
  }

  if (!fs.existsSync(bindingsDir)) {
    console.error(
      `❌ Bindings directory not found: ${nodeBindings} (${bindingsDir})`,
    );
    return false;
  }

  const sdkNodeModulesXmtpDir = path.join(sdkDir, "node_modules", "@xmtp");
  const symlinkTarget = path.join(sdkNodeModulesXmtpDir, "node-bindings");

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

  if (!needsUpdate) {
    console.log(
      `⏭️  node-sdk-${nodeSDK} → node-bindings-${nodeBindings} (already linked)`,
    );
    return true;
  }

  // Ensure the target directory exists
  fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

  // Remove existing symlink/file/directory if it exists
  if (fs.existsSync(symlinkTarget)) {
    try {
      const stats = fs.lstatSync(symlinkTarget);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(symlinkTarget);
      } else if (stats.isDirectory()) {
        fs.rmSync(symlinkTarget, { recursive: true, force: true });
      } else {
        fs.unlinkSync(symlinkTarget);
      }
    } catch {
      // If removal fails, try force removal
      try {
        fs.rmSync(symlinkTarget, { recursive: true, force: true });
      } catch (forceError) {
        console.error(
          `⚠️  Warning: Could not remove existing target ${symlinkTarget}: ${String(forceError)}`,
        );
        // Continue anyway - might still work if it's already the right symlink
      }
    }
  }

  // Verify the target is actually gone before creating symlink
  if (fs.existsSync(symlinkTarget)) {
    console.error(
      `❌ Cannot create symlink: ${symlinkTarget} still exists after removal attempt`,
    );
    return false;
  }

  try {
    const relativeBindingsPath = path.relative(
      sdkNodeModulesXmtpDir,
      bindingsDir,
    );
    fs.symlinkSync(relativeBindingsPath, symlinkTarget);
    console.log(`✅ node-sdk-${nodeSDK} → node-bindings-${nodeBindings}`);
    return true;
  } catch (error: any) {
    // Handle EEXIST error specifically - the target might still exist
    if (error?.code === "EEXIST") {
      // Try one more time to remove it
      try {
        if (fs.existsSync(symlinkTarget)) {
          const stats = fs.lstatSync(symlinkTarget);
          if (stats.isSymbolicLink()) {
            fs.unlinkSync(symlinkTarget);
          } else {
            fs.rmSync(symlinkTarget, { recursive: true, force: true });
          }
        }
        // Retry creating the symlink
        const relativeBindingsPath = path.relative(
          sdkNodeModulesXmtpDir,
          bindingsDir,
        );
        fs.symlinkSync(relativeBindingsPath, symlinkTarget);
        console.log(`✅ node-sdk-${nodeSDK} → node-bindings-${nodeBindings}`);
        return true;
      } catch (retryError) {
        console.error(
          `❌ Error linking node-sdk-${nodeSDK} to node-bindings-${nodeBindings} after retry: ${String(retryError)}`,
        );
        return false;
      }
    }
    console.error(
      `❌ Error linking node-sdk-${nodeSDK} to node-bindings-${nodeBindings}: ${String(error)}`,
    );
    return false;
  }
}

function linkAgentSDKToNodeSDK(agentSDK: string, nodeSDK: string): boolean {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");
  const agentSDKDir = path.join(xmtpDir, `agent-sdk-${agentSDK}`);
  const nodeSDKDir = path.join(xmtpDir, `node-sdk-${nodeSDK}`);

  if (!fs.existsSync(agentSDKDir)) {
    console.error(
      `❌ Agent SDK directory not found: ${agentSDK} (${agentSDKDir})`,
    );
    return false;
  }

  if (!fs.existsSync(nodeSDKDir)) {
    console.error(
      `❌ Node SDK directory not found: ${nodeSDK} (${nodeSDKDir})`,
    );
    return false;
  }

  const agentSDKNodeModulesXmtpDir = path.join(
    agentSDKDir,
    "node_modules",
    "@xmtp",
  );
  const symlinkTarget = path.join(agentSDKNodeModulesXmtpDir, "node-sdk");

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

  if (!needsUpdate) {
    console.log(
      `⏭️  agent-sdk-${agentSDK} → node-sdk-${nodeSDK} (already linked)`,
    );
    return true;
  }

  // Ensure the target directory exists
  fs.mkdirSync(agentSDKNodeModulesXmtpDir, { recursive: true });

  // Remove existing symlink/file/directory if it exists
  if (fs.existsSync(symlinkTarget)) {
    try {
      const stats = fs.lstatSync(symlinkTarget);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(symlinkTarget);
      } else if (stats.isDirectory()) {
        fs.rmSync(symlinkTarget, { recursive: true, force: true });
      } else {
        fs.unlinkSync(symlinkTarget);
      }
    } catch {
      // If removal fails, try force removal
      try {
        fs.rmSync(symlinkTarget, { recursive: true, force: true });
      } catch (forceError) {
        console.error(
          `⚠️  Warning: Could not remove existing target ${symlinkTarget}: ${String(forceError)}`,
        );
        // Continue anyway - might still work if it's already the right symlink
      }
    }
  }

  // Verify the target is actually gone before creating symlink
  if (fs.existsSync(symlinkTarget)) {
    console.error(
      `❌ Cannot create symlink: ${symlinkTarget} still exists after removal attempt`,
    );
    return false;
  }

  try {
    const relativeNodeSDKPath = path.relative(
      agentSDKNodeModulesXmtpDir,
      nodeSDKDir,
    );
    fs.symlinkSync(relativeNodeSDKPath, symlinkTarget);
    console.log(`✅ agent-sdk-${agentSDK} → node-sdk-${nodeSDK}`);
    return true;
  } catch (error: any) {
    // Handle EEXIST error specifically - the target might still exist
    if (error?.code === "EEXIST") {
      // Try one more time to remove it
      try {
        if (fs.existsSync(symlinkTarget)) {
          const stats = fs.lstatSync(symlinkTarget);
          if (stats.isSymbolicLink()) {
            fs.unlinkSync(symlinkTarget);
          } else {
            fs.rmSync(symlinkTarget, { recursive: true, force: true });
          }
        }
        // Retry creating the symlink
        const relativeNodeSDKPath = path.relative(
          agentSDKNodeModulesXmtpDir,
          nodeSDKDir,
        );
        fs.symlinkSync(relativeNodeSDKPath, symlinkTarget);
        console.log(`✅ agent-sdk-${agentSDK} → node-sdk-${nodeSDK}`);
        return true;
      } catch (retryError) {
        console.error(
          `❌ Error linking agent-sdk-${agentSDK} to node-sdk-${nodeSDK} after retry: ${String(retryError)}`,
        );
        return false;
      }
    }
    console.error(
      `❌ Error linking agent-sdk-${agentSDK} to node-sdk-${nodeSDK}: ${String(error)}`,
    );
    return false;
  }
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

  for (const config of SYMLINK_NODE_BINDINGS) {
    if (!linkNodeSDKToBindings(config.nodeSDK, config.nodeBindings)) {
      hasErrors = true;
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

  for (const config of SYMLINK_AGENT_SDK) {
    if (!linkAgentSDKToNodeSDK(config.agentSDK, config.nodeSDK)) {
      hasErrors = true;
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

  const options = parseArgs(args);
  const shouldClean = options.clean;

  // Always remove node_modules before running
  if (!process.env.GITHUB_ACTIONS) {
    const nodeModulesDir = path.join(process.cwd(), "node_modules");
    if (fs.existsSync(nodeModulesDir)) {
      try {
        fs.rmSync(nodeModulesDir, { recursive: true, force: true });
        console.log("🧹 Removed node_modules");
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

  if (shouldClean) {
    cleanPackageJson();
  }

  // Always run both operations
  createBindingsSymlinks();
  createAgentSDKSymlinks();

  if (options.agentSDK || options.nodeSDK || options.nodeBindings) {
    let resolvedNodeSDK = options.nodeSDK;

    if (!resolvedNodeSDK && options.nodeBindings) {
      const matching = SYMLINK_NODE_BINDINGS.find(
        (v) => v.nodeBindings === options.nodeBindings,
      );
      resolvedNodeSDK = matching?.nodeSDK;
    }

    if (!resolvedNodeSDK && options.agentSDK) {
      const matching = SYMLINK_AGENT_SDK.find(
        (v) => v.agentSDK === options.agentSDK,
      );
      resolvedNodeSDK = matching?.nodeSDK;
    }

    if (options.nodeBindings && !resolvedNodeSDK) {
      console.error(
        `❌ Unable to resolve node-sdk version for node-bindings-${options.nodeBindings}. Provide --nodeSDK to continue.`,
      );
      process.exit(1);
    }

    if (options.nodeBindings && resolvedNodeSDK) {
      if (!linkNodeSDKToBindings(resolvedNodeSDK, options.nodeBindings)) {
        process.exit(1);
      }
    }

    if (options.agentSDK) {
      if (!resolvedNodeSDK) {
        console.error(
          `❌ Unable to resolve node-sdk version for agent-sdk-${options.agentSDK}. Provide --nodeSDK or --nodeBindings.`,
        );
        process.exit(1);
      }

      if (!linkAgentSDKToNodeSDK(options.agentSDK, resolvedNodeSDK)) {
        process.exit(1);
      }
    }
  }

  console.log("✅ All version setup complete!");
  console.log("Done");
}

main();
