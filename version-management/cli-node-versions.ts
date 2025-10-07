import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { VersionList } from "version-management/sdk-node-versions";

function showHelp() {
  console.log(`
XMTP Versions CLI - SDK version management and setup

USAGE:
  yarn versions [options]

OPTIONS:
  --clean               Clean package.json imports and node_modules before setup
  -h, --help            Show this help message

DESCRIPTION:
  Sets up SDK version testing by creating bindings symlinks for different
  XMTP SDK versions. This enables testing across multiple SDK versions
  simultaneously.

EXAMPLES:
  yarn versions
  yarn versions --clean
  yarn versions --help

For more information, see: cli/readme.md
`);
}

function createBindingsSymlinks() {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found");
    process.exit(1);
  }

  console.log("Creating bindings symlinks...");

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

    // Remove existing
    if (fs.existsSync(path.join(sdkDir, "node_modules"))) {
      fs.rmSync(path.join(sdkDir, "node_modules"), {
        recursive: true,
        force: true,
      });
    }

    // Create directories and symlink
    fs.mkdirSync(sdkNodeModulesXmtpDir, { recursive: true });

    try {
      const relativeBindingsPath = path.relative(
        sdkNodeModulesXmtpDir,
        bindingsDir,
      );
      fs.symlinkSync(relativeBindingsPath, symlinkTarget);
      console.log(`${config.nodeSDK} -> ${config.nodeBindings}`);
    } catch (error) {
      console.error(`Error linking ${config.nodeSDK}: ${String(error)}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("❌ Failed to create all required symlinks");
    process.exit(1);
  }
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
  }

  if (!process.env.GITHUB_ACTIONS) {
    const nodeModulesDir = path.join(process.cwd(), "node_modules");
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }
    execSync("yarn install", { stdio: "inherit" });
  }

  createBindingsSymlinks();
  console.log("Done");
}

main();
