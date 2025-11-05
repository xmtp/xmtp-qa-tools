import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { AgentVersionList } from "./agent-sdk";

function showHelp() {
  console.log(`
XMTP Agent SDK Versions CLI - Agent SDK version management and setup

USAGE:
  yarn agent-versions [options]

OPTIONS:
  --clean               Clean package.json imports and node_modules before setup
  -h, --help            Show this help message

DESCRIPTION:
  Sets up Agent SDK version testing by creating symlinks for different
  XMTP Agent SDK versions. For each agent-sdk version, creates a symlink
  to the corresponding node-sdk version inside its node_modules. This enables
  testing agents across multiple Agent SDK versions simultaneously.

EXAMPLES:
  yarn agent-versions
  yarn agent-versions --clean
  yarn agent-versions --help

For more information, see: agents/versions/README.md
`);
}

function createAgentSDKSymlinks() {
  const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

  if (!fs.existsSync(xmtpDir)) {
    console.error("@xmtp directory not found");
    process.exit(1);
  }

  console.log("Creating Agent SDK symlinks...");

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

    // Remove existing node_modules if it exists
    if (fs.existsSync(path.join(agentSDKDir, "node_modules"))) {
      fs.rmSync(path.join(agentSDKDir, "node_modules"), {
        recursive: true,
        force: true,
      });
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
        `✅ agent-sdk-${config.agentSDK} -> node-sdk-${config.nodeSDK}`,
      );
    } catch (error) {
      console.error(
        `❌ Error linking agent-sdk-${config.agentSDK}: ${String(error)}`,
      );
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

  createAgentSDKSymlinks();
  console.log("Done");
}

main();
