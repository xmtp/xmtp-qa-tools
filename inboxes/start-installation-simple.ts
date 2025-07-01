import fs from "fs";
import path from "path";

const INSTALLATIONS_DIR = "./inboxes/installations";

interface InstallationData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installationId: string;
  dbPath: string;
  env: string;
  groupsCreated: number;
  conversationsCreated: number;
}

/**
 * Maps installation numbers to worker-friendly names
 * Using a simple pattern: installation-1 -> inst1, installation-2 -> inst2, etc.
 */
function getWorkerNameFromInstallation(installationNumber: number): string {
  return `inst${installationNumber}`;
}

/**
 * Sets up environment variables for a specific installation so workers can use them
 */
function setupInstallationEnvironment(installation: InstallationData, workerName: string): void {
  const envVars = {
    [`WALLET_KEY_${workerName.toUpperCase()}`]: installation.walletKey,
    [`ENCRYPTION_KEY_${workerName.toUpperCase()}`]: installation.dbEncryptionKey.replace('0x', ''),
  };

  // Set environment variables
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  console.log(`🔑 Set environment variables for worker "${workerName}"`);
  console.log(`   Address: ${installation.accountAddress}`);
  console.log(`   InboxId: ${installation.inboxId}`);
  console.log(`   DB Path: ${installation.dbPath}`);
  console.log(`   Groups: ${installation.groupsCreated}, Conversations: ${installation.conversationsCreated}`);
}

/**
 * Loads installation data from the metadata file
 */
function loadInstallations(env: string = "local"): InstallationData[] {
  const installationsFile = path.join(INSTALLATIONS_DIR, `installations-${env}.json`);
  
  if (!fs.existsSync(installationsFile)) {
    throw new Error(`Installations file not found: ${installationsFile}`);
  }

  try {
    const data = fs.readFileSync(installationsFile, "utf8");
    return JSON.parse(data) as InstallationData[];
  } catch (error) {
    throw new Error(`Failed to parse installations file: ${error}`);
  }
}

/**
 * Lists available installations
 */
export function listInstallations(env: string = "local"): void {
  try {
    const installations = loadInstallations(env);
    console.log(`📋 Available installations in ${env} environment:`);
    console.log("─".repeat(80));
    
    installations.forEach((installation, index) => {
      const workerName = getWorkerNameFromInstallation(index + 1);
      console.log(`${index + 1}. ${workerName} - ${installation.accountAddress}`);
      console.log(`   InboxId: ${installation.inboxId}`);
      console.log(`   Groups: ${installation.groupsCreated}, Conversations: ${installation.conversationsCreated}`);
      console.log(`   DB Path: ${installation.dbPath}`);
      console.log("");
    });
  } catch (error) {
    console.error(`❌ Failed to list installations: ${error}`);
  }
}

/**
 * Prepares environment variables for starting a specific installation
 * This function sets up the environment so the workers framework can use the installation
 */
export function prepareInstallationForWorkers(
  installationNumber: number,
  env: string = "local"
): { workerName: string; installation: InstallationData } {
  console.log(`🔧 Preparing installation ${installationNumber} for workers framework...`);
  
  // Load installations data
  const installations = loadInstallations(env);
  
  if (installationNumber < 1 || installationNumber > installations.length) {
    throw new Error(`Invalid installation number: ${installationNumber}. Available: 1-${installations.length}`);
  }
  
  const installation = installations[installationNumber - 1];
  const workerName = getWorkerNameFromInstallation(installationNumber);
  
  // Setup environment variables for this installation
  setupInstallationEnvironment(installation, workerName);
  
  console.log(`✅ Installation ${installationNumber} prepared as worker "${workerName}"`);
  
  return { workerName, installation };
}

/**
 * Demonstrates the concept by preparing installations for workers framework
 */
export function demonstrateWorkerPreparation(): void {
  console.log("🎯 XMTP Installation → Workers Framework Mapping");
  console.log("=" .repeat(60));
  
  try {
    // List available installations
    console.log("\n1️⃣ Available installations:");
    listInstallations();
    
    // Prepare first 3 installations for workers
    console.log("\n2️⃣ Preparing installations for workers framework:");
    console.log("".padEnd(60, "-"));
    
    for (let i = 1; i <= 3; i++) {
      const { workerName, installation } = prepareInstallationForWorkers(i);
      
      console.log(`\n🔗 Installation ${i} → Worker "${workerName}"`);
      console.log(`   Environment variables set:`);
      console.log(`   - WALLET_KEY_${workerName.toUpperCase()}=${installation.walletKey}`);
      console.log(`   - ENCRYPTION_KEY_${workerName.toUpperCase()}=${installation.dbEncryptionKey.replace('0x', '')}`);
      console.log(`   Ready for: getWorkers(["${workerName}"], testName)`);
    }
    
    console.log("\n3️⃣ Example workers framework usage:");
    console.log("".padEnd(60, "-"));
    console.log(`
// After running prepareInstallationForWorkers(1, 2, 3):
import { getWorkers } from "@workers/manager";

const workers = await getWorkers(["inst1", "inst2", "inst3"], "my-test");

// These workers will automatically use the installation data:
const worker1 = workers.get("inst1"); // Uses installation-1 data
const worker2 = workers.get("inst2"); // Uses installation-2 data
const worker3 = workers.get("inst3"); // Uses installation-3 data

// Create a group between installations
const group = await workers.createGroupBetweenAll("Cross-Installation Group");
`);
    
    console.log("\n4️⃣ Key Benefits:");
    console.log("".padEnd(60, "-"));
    console.log("✅ Installations map to worker names by convention");
    console.log("✅ Workers framework loads pre-existing database content");
    console.log("✅ No manual key management needed");
    console.log("✅ Easy to test multi-installation scenarios");
    
    console.log("\n🎉 Setup complete! Ready to use installations with workers framework.");
    
  } catch (error) {
    console.error("❌ Demonstration failed:", error);
  }
}

// Execute demonstration if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateWorkerPreparation();
}