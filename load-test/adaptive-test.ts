#!/usr/bin/env tsx
/**
 * Adaptive Load Tester - Automatically ramps up until hitting memory limits
 * 
 * This pushes the system to max capacity without crashing
 */

import { Client, type Group } from "@xmtp/node-sdk";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { freemem, totalmem } from "os";
import { createSigner, encryptionKeyFromHex } from "./xmtp-helpers";
import { getWorkloadMix, selectOperation, type WorkloadMix } from "./workload-config";

interface TestIdentity {
  accountAddress: string;
  privateKey: string;
  encryptionKey: string;
  inboxId: string;
  installationId: string;
}

interface GroupInfo {
  id: string;
  name: string;
  memberInboxIds: string[];
}

interface LoadTestConfig {
  identities: TestIdentity[];
  groups: GroupInfo[];
  poolIdentities: TestIdentity[];
  config: {
    env: string;
    apiUrl?: string;
    d14nHost?: string;
    workloadPreset?: string;
  };
}

interface OperationStats {
  sendMessage: number;
  updateName: number;
  updateDescription: number;
  updateImageUrl: number;
  addMember: number;
  removeMember: number;
  addAdmin: number;
  removeAdmin: number;
  addSuperAdmin: number;
  removeSuperAdmin: number;
  sync: number;
  errors: Record<string, number>;
}

// Configuration
const MIN_FREE_MEMORY_MB = 200;  // Stop ramping when we hit this
const MEMORY_CHECK_INTERVAL_MS = 5000;  // Check memory every 5s
const RAMP_UP_INTERVAL_MS = 10000;  // Increase load every 10s
const INITIAL_CONCURRENCY = 2;
const MAX_CONCURRENCY = 200;
const MESSAGES_PER_WORKER = 10;  // Each worker tries to send this many msg/s

let currentConcurrency = INITIAL_CONCURRENCY;
let operationStats: OperationStats = {
  sendMessage: 0,
  updateName: 0,
  updateDescription: 0,
  updateImageUrl: 0,
  addMember: 0,
  removeMember: 0,
  addAdmin: 0,
  removeAdmin: 0,
  addSuperAdmin: 0,
  removeSuperAdmin: 0,
  sync: 0,
  errors: {},
};
let isRamping = true;
let clients: Map<string, Client> = new Map();
let workloadMix: WorkloadMix | null = null;

async function loadConfig(): Promise<LoadTestConfig> {
  const configPath = "./data/load-test-config.json";
  if (!existsSync(configPath)) {
    console.error("❌ Config not found. Run setup first.");
    process.exit(1);
  }
  const config: LoadTestConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  
  // Load workload mix
  const preset = config.config.workloadPreset || 'messagesOnly';
  workloadMix = getWorkloadMix(preset);
  console.log(`✓ Workload preset: ${preset}`);
  
  return config;
}

function getMemoryStats() {
  const freeMemMB = Math.floor(freemem() / (1024 * 1024));
  const totalMemMB = Math.floor(totalmem() / (1024 * 1024));
  const usedMemMB = totalMemMB - freeMemMB;
  const usedPercent = ((usedMemMB / totalMemMB) * 100).toFixed(1);
  
  return { freeMemMB, totalMemMB, usedMemMB, usedPercent };
}

async function createClient(identity: TestIdentity, config: LoadTestConfig): Promise<Client> {
  const cached = clients.get(identity.inboxId);
  if (cached) return cached;
  
  const signer = createSigner(identity.privateKey);
  
  const clientOptions: any = {
    env: config.config.env as any,
    dbEncryptionKey: encryptionKeyFromHex(identity.encryptionKey),
    dbPath: `./data/dbs/${identity.inboxId.slice(0, 8)}.db3`,
  };
  
  if (config.config.d14nHost) {
    clientOptions.d14nHost = config.config.d14nHost;
  } else if (config.config.apiUrl) {
    clientOptions.apiUrl = config.config.apiUrl;
  }
  
  const client = await Client.create(signer, clientOptions);
  await client.conversations.sync();
  clients.set(identity.inboxId, client);
  
  return client;
}

async function getGroup(client: Client, groupId: string): Promise<Group> {
  const conversation = await client.conversations.getConversationById(groupId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${groupId}`);
  }
  return conversation as Group;
}

function selectRandomGroup(config: LoadTestConfig): GroupInfo {
  return config.groups[Math.floor(Math.random() * config.groups.length)];
}

function selectSenderForGroup(config: LoadTestConfig, group: GroupInfo): TestIdentity {
  const memberIdentities = config.identities.filter(
    id => group.memberInboxIds.includes(id.inboxId)
  );
  if (memberIdentities.length === 0) {
    throw new Error(`No identities found for group ${group.id}`);
  }
  return memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
}

function selectRandomPoolIdentity(config: LoadTestConfig): TestIdentity {
  if (!config.poolIdentities || config.poolIdentities.length === 0) {
    throw new Error('No pool identities available for add/remove operations');
  }
  return config.poolIdentities[Math.floor(Math.random() * config.poolIdentities.length)];
}

async function opSendMessage(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  await conversation.send(`Adaptive test msg ${operationStats.sendMessage} at ${new Date().toISOString()}`);
  operationStats.sendMessage++;
}

async function opUpdateName(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  await conversation.updateName(`Adaptive Test - ${Date.now()}`);
  operationStats.updateName++;
}

async function opUpdateDescription(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  await conversation.updateDescription(`Adaptive test updated at ${new Date().toISOString()}`);
  operationStats.updateDescription++;
}

async function opUpdateImageUrl(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  await conversation.updateImageUrl(`https://example.com/image-${Date.now()}.jpg`);
  operationStats.updateImageUrl++;
}

async function opAddMember(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const poolIdentity = selectRandomPoolIdentity(config);
  await conversation.addMembers([poolIdentity.inboxId]);
  operationStats.addMember++;
}

async function opRemoveMember(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  
  if (members.length <= 2) {
    await opAddMember(config, group, sender);
    return;
  }
  
  const removableMembers = members.filter(m => m.inboxId !== sender.inboxId);
  if (removableMembers.length === 0) {
    throw new Error('No removable members');
  }
  
  const targetMember = removableMembers[Math.floor(Math.random() * removableMembers.length)];
  await conversation.removeMembers([targetMember.inboxId]);
  operationStats.removeMember++;
}

async function opAddAdmin(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  const nonAdminMembers = members.filter(m => !conversation.isAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  
  if (nonAdminMembers.length === 0) {
    return;
  }
  
  const targetMember = nonAdminMembers[Math.floor(Math.random() * nonAdminMembers.length)];
  await conversation.addAdmin(targetMember.inboxId);
  operationStats.addAdmin++;
}

async function opRemoveAdmin(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const admins = conversation.admins.filter(adminId => !conversation.isSuperAdmin(adminId));
  
  if (admins.length === 0) {
    return;
  }
  
  const targetAdmin = admins[Math.floor(Math.random() * admins.length)];
  await conversation.removeAdmin(targetAdmin);
  operationStats.removeAdmin++;
}

async function opAddSuperAdmin(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  const nonSuperAdminMembers = members.filter(m => !conversation.isSuperAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  
  if (nonSuperAdminMembers.length === 0) {
    return;
  }
  
  const targetMember = nonSuperAdminMembers[Math.floor(Math.random() * nonSuperAdminMembers.length)];
  await conversation.addSuperAdmin(targetMember.inboxId);
  operationStats.addSuperAdmin++;
}

async function opRemoveSuperAdmin(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  const superAdmins = conversation.superAdmins.filter(adminId => adminId !== sender.inboxId);
  
  if (superAdmins.length === 0) {
    return;
  }
  
  const targetSuperAdmin = superAdmins[Math.floor(Math.random() * superAdmins.length)];
  await conversation.removeSuperAdmin(targetSuperAdmin);
  operationStats.removeSuperAdmin++;
}

async function opSync(config: LoadTestConfig, group: GroupInfo, sender: TestIdentity): Promise<void> {
  const client = await createClient(sender, config);
  const conversation = await getGroup(client, group.id);
  await conversation.sync();
  operationStats.sync++;
}

async function executeOperation(config: LoadTestConfig): Promise<boolean> {
  try {
    if (!workloadMix) {
      throw new Error('Workload mix not loaded');
    }
    
    const operation = selectOperation(workloadMix);
    const group = selectRandomGroup(config);
    const sender = selectSenderForGroup(config, group);
    
    switch (operation) {
      case 'sendMessage':
        await opSendMessage(config, group, sender);
        break;
      case 'updateName':
        await opUpdateName(config, group, sender);
        break;
      case 'updateDescription':
        await opUpdateDescription(config, group, sender);
        break;
      case 'updateImageUrl':
        await opUpdateImageUrl(config, group, sender);
        break;
      case 'addMember':
        await opAddMember(config, group, sender);
        break;
      case 'removeMember':
        await opRemoveMember(config, group, sender);
        break;
      case 'addAdmin':
        await opAddAdmin(config, group, sender);
        break;
      case 'removeAdmin':
        await opRemoveAdmin(config, group, sender);
        break;
      case 'addSuperAdmin':
        await opAddSuperAdmin(config, group, sender);
        break;
      case 'removeSuperAdmin':
        await opRemoveSuperAdmin(config, group, sender);
        break;
      case 'sync':
        await opSync(config, group, sender);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!operationStats.errors[errorMsg]) {
      operationStats.errors[errorMsg] = 0;
    }
    operationStats.errors[errorMsg]++;
    return false;
  }
}

async function workerLoop(config: LoadTestConfig, workerId: number) {
  while (true) {
    // Execute burst of operations
    const promises = [];
    for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
      promises.push(executeOperation(config));
    }
    await Promise.allSettled(promises);
    
    // Wait 1 second between bursts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function memoryMonitor() {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, MEMORY_CHECK_INTERVAL_MS));
    
    const mem = getMemoryStats();
    const totalOps = Object.values(operationStats).reduce((sum, val) => 
      typeof val === 'number' ? sum + val : sum, 0
    );
    const totalErrors = Object.values(operationStats.errors).reduce((sum, count) => sum + count, 0);
    const rate = (totalOps / ((Date.now() - startTime) / 1000)).toFixed(1);
    
    console.log(`\n📊 Memory: ${mem.freeMemMB}MB free / ${mem.totalMemMB}MB total (${mem.usedPercent}% used)`);
    console.log(`⚡ Load: ${currentConcurrency} workers | Ops: ${totalOps} | Errors: ${totalErrors} | Rate: ${rate} ops/s`);
    
    if (mem.freeMemMB < MIN_FREE_MEMORY_MB) {
      console.log(`\n⚠️  Memory limit reached! (${mem.freeMemMB}MB < ${MIN_FREE_MEMORY_MB}MB)`);
      console.log(`🛑 Stopping ramp-up at ${currentConcurrency} workers`);
      isRamping = false;
    }
  }
}

async function rampController() {
  while (isRamping) {
    await new Promise(resolve => setTimeout(resolve, RAMP_UP_INTERVAL_MS));
    
    const mem = getMemoryStats();
    
    if (mem.freeMemMB > MIN_FREE_MEMORY_MB * 2 && currentConcurrency < MAX_CONCURRENCY) {
      // Plenty of headroom, ramp up
      currentConcurrency = Math.min(MAX_CONCURRENCY, currentConcurrency + 2);
      console.log(`\n📈 Ramping UP to ${currentConcurrency} workers (${mem.freeMemMB}MB free)`);
    } else if (mem.freeMemMB < MIN_FREE_MEMORY_MB * 1.5) {
      // Getting close, slow down
      console.log(`\n⚠️  Approaching memory limit (${mem.freeMemMB}MB free)`);
      isRamping = false;
    }
  }
}

let startTime: number;
let workers: Promise<void>[] = [];

async function main() {
  console.log("🚀 XMTP Adaptive Load Test");
  console.log("=".repeat(60));
  console.log(`Target: MAX system capacity (stop at ${MIN_FREE_MEMORY_MB}MB free)`);
  console.log(`Starting: ${INITIAL_CONCURRENCY} workers`);
  console.log(`Max: ${MAX_CONCURRENCY} workers`);
  console.log("=".repeat(60));
  console.log();
  
  const config = await loadConfig();
  console.log(`✓ Loaded ${config.identities.length} identities, ${config.groups.length} groups`);
  
  const initialMem = getMemoryStats();
  console.log(`📊 Initial: ${initialMem.freeMemMB}MB free / ${initialMem.totalMemMB}MB total`);
  console.log();
  
  startTime = Date.now();
  
  // Start monitoring
  memoryMonitor().catch(console.error);
  rampController().catch(console.error);
  
  // Start initial workers
  for (let i = 0; i < currentConcurrency; i++) {
    workers.push(workerLoop(config, i));
  }
  
  // Dynamically add workers as we ramp
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add new workers if concurrency increased
    while (workers.length < currentConcurrency) {
      workers.push(workerLoop(config, workers.length));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  const duration = (Date.now() - startTime) / 1000;
  const mem = getMemoryStats();
  const totalOps = Object.values(operationStats).reduce((sum, val) => 
    typeof val === 'number' ? sum + val : sum, 0
  );
  const totalErrors = Object.values(operationStats.errors).reduce((sum, count) => sum + count, 0);
  
  console.log("\n\n" + "=".repeat(60));
  console.log("Test Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`Total operations: ${totalOps.toLocaleString()}`);
  console.log(`Total errors: ${totalErrors.toLocaleString()}`);
  console.log(`Success rate: ${((totalOps / (totalOps + totalErrors)) * 100).toFixed(2)}%`);
  console.log(`Average rate: ${(totalOps / duration).toFixed(1)} ops/s`);
  console.log(`Peak workers: ${currentConcurrency}`);
  console.log(`Final memory: ${mem.freeMemMB}MB free (${mem.usedPercent}% used)`);
  
  console.log("\n" + "-".repeat(60));
  console.log("Operations Breakdown:");
  console.log("-".repeat(60));
  
  const operations = Object.entries(operationStats)
    .filter(([key]) => key !== 'errors')
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  
  for (const [operation, count] of operations) {
    const percentage = totalOps > 0 ? ((count as number / totalOps) * 100).toFixed(2) : '0.00';
    console.log(`  ${operation.padEnd(20)} ${(count as number).toLocaleString().padStart(10)} (${percentage}%)`);
  }
  
  if (totalErrors > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("Top Errors:");
    console.log("-".repeat(60));
    
    const topErrors = Object.entries(operationStats.errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [error, count] of topErrors) {
      console.log(`  ${count.toString().padStart(6)}x ${error}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  
  // Save report
  try {
    const report = {
      summary: {
        duration: `${duration.toFixed(1)}s`,
        totalOperations: totalOps,
        totalErrors: totalErrors,
        successRate: `${((totalOps / (totalOps + totalErrors)) * 100).toFixed(2)}%`,
        averageRate: `${(totalOps / duration).toFixed(1)} ops/s`,
        peakWorkers: currentConcurrency,
        finalMemory: `${mem.freeMemMB}MB free (${mem.usedPercent}% used)`,
      },
      operations: operationStats,
      generatedAt: new Date().toISOString(),
    };
    
    writeFileSync('./data/adaptive-report.json', JSON.stringify(report, null, 2));
    console.log("\nReport saved to: ./data/adaptive-report.json");
  } catch (error) {
    console.warn("Failed to save report:", error);
  }
  
  process.exit(0);
});

main().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});

