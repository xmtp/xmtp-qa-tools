import fs from "fs";
import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";
import { typeofStream, typeOfResponse } from "@workers/main";

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
    [`ENCRYPTION_KEY_${workerName.toUpperCase()}`]: installation.dbEncryptionKey,
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
  const installationsFile = `${INSTALLATIONS_DIR}/installations-${env}.json`;
  
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
 * Starts a specific installation using the workers framework
 */
export async function startInstallation(
  installationNumber: number,
  testName: string = "installation-test",
  env: string = "local"
) {
  console.log(`🚀 Starting installation ${installationNumber} using workers framework...`);
  
  // Load environment
  loadEnv(testName);
  
  // Load installations data
  const installations = loadInstallations(env);
  
  if (installationNumber < 1 || installationNumber > installations.length) {
    throw new Error(`Invalid installation number: ${installationNumber}. Available: 1-${installations.length}`);
  }
  
  const installation = installations[installationNumber - 1];
  const workerName = getWorkerNameFromInstallation(installationNumber);
  
  // Setup environment variables for this installation
  setupInstallationEnvironment(installation, workerName);
  
  // Create worker using the naming convention
  console.log(`🔧 Creating worker "${workerName}" for installation ${installationNumber}...`);
  
  const workers = await getWorkers(
    [workerName],
    testName,
    typeofStream.Message,
    typeOfResponse.Gm
  );
  
  const worker = workers.get(workerName);
  if (!worker) {
    throw new Error(`Failed to create worker for installation ${installationNumber}`);
  }
  
  console.log(`✅ Successfully started installation ${installationNumber} as worker "${workerName}"`);
  console.log(`   Worker InboxId: ${worker.inboxId}`);
  console.log(`   Worker Address: ${worker.address}`);
  console.log(`   Worker DB Path: ${worker.dbPath}`);
  
  // Sync conversations to load existing data
  console.log(`🔄 Syncing conversations...`);
  await worker.client.conversations.sync();
  
  const conversations = await worker.client.conversations.list();
  console.log(`📱 Found ${conversations.length} conversations in the installation`);
  
  return worker;
}

/**
 * Starts multiple installations as workers
 */
export async function startInstallations(
  installationNumbers: number[],
  testName: string = "installation-test",
  env: string = "local"
) {
  console.log(`🚀 Starting ${installationNumbers.length} installations using workers framework...`);
  
  // Load environment
  loadEnv(testName);
  
  // Load installations data
  const installations = loadInstallations(env);
  
  // Validate all installation numbers
  for (const num of installationNumbers) {
    if (num < 1 || num > installations.length) {
      throw new Error(`Invalid installation number: ${num}. Available: 1-${installations.length}`);
    }
  }
  
  // Setup environment variables for all installations
  const workerNames: string[] = [];
  for (const installationNumber of installationNumbers) {
    const installation = installations[installationNumber - 1];
    const workerName = getWorkerNameFromInstallation(installationNumber);
    setupInstallationEnvironment(installation, workerName);
    workerNames.push(workerName);
  }
  
  // Create all workers
  console.log(`🔧 Creating workers: ${workerNames.join(", ")}...`);
  
  const workers = await getWorkers(
    workerNames,
    testName,
    typeofStream.Message,
    typeOfResponse.Gpt
  );
  
  console.log(`✅ Successfully started ${installationNumbers.length} installations as workers`);
  
  // Sync all conversations
  console.log(`🔄 Syncing conversations for all workers...`);
  for (const workerName of workerNames) {
    const worker = workers.get(workerName);
    if (worker) {
      await worker.client.conversations.sync();
      const conversations = await worker.client.conversations.list();
      console.log(`📱 Worker "${workerName}": ${conversations.length} conversations`);
    }
  }
  
  return workers;
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

// Example usage functions
export async function demonstrateInstallationStartup() {
  console.log("🎯 Demonstration: Starting Installation with Workers Framework");
  console.log("=" .repeat(70));
  
  try {
    // List available installations
    listInstallations();
    
    // Start installation 1
    console.log("Starting installation 1...");
    const worker1 = await startInstallation(1, "demo-test");
    
    // Start multiple installations
    console.log("\nStarting installations 1, 2, and 3...");
    const workers = await startInstallations([1, 2, 3], "multi-demo-test");
    
    // Create a group between the workers
    console.log("\n🤝 Creating a group between all workers...");
    const group = await workers.createGroupBetweenAll("Demo Group from Installations");
    
    console.log(`✅ Created group: ${group.name}`);
    console.log(`   Group ID: ${group.id}`);
    
    // Send a message
    const creator = workers.getCreator();
    await group.send(`Hello from installation worker ${creator.name}! This group was created from pre-populated installation databases.`);
    
    console.log("🎉 Successfully demonstrated installation startup with workers framework!");
    
    // Cleanup
    await workers.terminateAll();
    
  } catch (error) {
    console.error("❌ Demonstration failed:", error);
  }
}