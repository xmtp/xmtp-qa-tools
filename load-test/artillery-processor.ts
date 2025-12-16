/**
 * XMTP Load Test Artillery Processor
 * 
 * This processor handles the actual message sending during the load test.
 * It manages XMTP clients, distributes load across groups, and tracks metrics.
 */

import { Client, type Group } from "@xmtp/node-sdk";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
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
  createdAt: string;
  config: {
    numIdentities: number;
    numGroups: number;
    membersPerGroup: number;
    poolSize: number;
    env: string;
    d14nHost?: string;
    apiUrl?: string;
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

// Global state - initialized once per worker
let config: LoadTestConfig | null = null;
let clients: Map<string, Client> = new Map();
let workloadMix: WorkloadMix | null = null;
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
let messageCounter = 0;
let lastLogTime = Date.now();
let operationsThisSecond = 0;

/**
 * Load configuration from disk
 */
function loadConfig(): LoadTestConfig {
  if (config) return config;
  
  const configPath = process.env.CONFIG_PATH || "./data/load-test-config.json";
  const configData = readFileSync(configPath, "utf-8");
  config = JSON.parse(configData);
  
  // Load workload mix
  const preset = config!.config.workloadPreset || 'messagesOnly';
  workloadMix = getWorkloadMix(preset);
  
  console.log(`[Worker ${process.pid}] Loaded config: ${config!.identities.length} identities, ${config!.groups.length} groups, ${config!.poolIdentities?.length || 0} pool identities`);
  console.log(`[Worker ${process.pid}] Workload preset: ${preset}`);
  
  return config!;
}

/**
 * Get or create an XMTP client for an identity
 */
async function getClient(identity: TestIdentity): Promise<Client> {
  const cached = clients.get(identity.inboxId);
  if (cached) return cached;
  
  try {
    const signer = createSigner(identity.privateKey);
    
    const clientOptions: any = {
      env: config!.config.env as any,
      dbEncryptionKey: encryptionKeyFromHex(identity.encryptionKey),
      dbPath: `./data/dbs/${identity.inboxId.slice(0, 8)}.db3`,
    };
    
    if (config!.config.d14nHost) {
      clientOptions.d14nHost = config!.config.d14nHost;
    } else if (config!.config.apiUrl) {
      clientOptions.apiUrl = config!.config.apiUrl;
    }
    
    const client = await Client.create(signer, clientOptions);
    
    // Sync conversations to ensure they're available
    await client.conversations.sync();
    
    clients.set(identity.inboxId, client);
    console.log(`[Worker ${process.pid}] Created client for ${identity.accountAddress}`);
    
    return client;
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to create client:`, error);
    throw error;
  }
}

/**
 * Select a random identity that is a member of a given group
 */
function selectSenderForGroup(group: GroupInfo): TestIdentity {
  const cfg = loadConfig();
  const memberIdentities = cfg.identities.filter(
    id => group.memberInboxIds.includes(id.inboxId)
  );
  
  if (memberIdentities.length === 0) {
    throw new Error(`No identities found for group ${group.id}`);
  }
  
  return memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
}

/**
 * Select a random group
 */
function selectRandomGroup(): GroupInfo {
  const cfg = loadConfig();
  return cfg.groups[Math.floor(Math.random() * cfg.groups.length)];
}

/**
 * Select a random pool identity
 */
function selectRandomPoolIdentity(): TestIdentity {
  const cfg = loadConfig();
  if (!cfg.poolIdentities || cfg.poolIdentities.length === 0) {
    throw new Error('No pool identities available for add/remove operations');
  }
  return cfg.poolIdentities[Math.floor(Math.random() * cfg.poolIdentities.length)];
}

/**
 * Get a group conversation object
 */
async function getGroup(client: Client, groupId: string): Promise<Group> {
  const conversation = await client.conversations.getConversationById(groupId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${groupId}`);
  }
  return conversation as Group;
}

/**
 * Operation: Send message
 */
async function opSendMessage(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const messageText = `Load test message ${operationStats.sendMessage} from ${sender.accountAddress.slice(0, 8)} at ${new Date().toISOString()}`;
  
  const startTime = Date.now();
  await conversation.send(messageText);
  const duration = Date.now() - startTime;
  
  operationStats.sendMessage++;
  events.emit('counter', 'operations.sendMessage', 1);
  events.emit('histogram', 'operation.sendMessage.duration', duration);
}

/**
 * Operation: Update group name
 */
async function opUpdateName(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const newName = `Load Test Group - ${Date.now()}`;
  
  const startTime = Date.now();
  await conversation.updateName(newName);
  const duration = Date.now() - startTime;
  
  operationStats.updateName++;
  events.emit('counter', 'operations.updateName', 1);
  events.emit('histogram', 'operation.updateName.duration', duration);
}

/**
 * Operation: Update group description
 */
async function opUpdateDescription(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const newDescription = `Load test description updated at ${new Date().toISOString()}`;
  
  const startTime = Date.now();
  await conversation.updateDescription(newDescription);
  const duration = Date.now() - startTime;
  
  operationStats.updateDescription++;
  events.emit('counter', 'operations.updateDescription', 1);
  events.emit('histogram', 'operation.updateDescription.duration', duration);
}

/**
 * Operation: Update group image URL
 */
async function opUpdateImageUrl(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const newImageUrl = `https://example.com/image-${Date.now()}.jpg`;
  
  const startTime = Date.now();
  await conversation.updateImageUrl(newImageUrl);
  const duration = Date.now() - startTime;
  
  operationStats.updateImageUrl++;
  events.emit('counter', 'operations.updateImageUrl', 1);
  events.emit('histogram', 'operation.updateImageUrl.duration', duration);
}

/**
 * Operation: Add member to group
 */
async function opAddMember(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const poolIdentity = selectRandomPoolIdentity();
  
  const startTime = Date.now();
  await conversation.addMembers([poolIdentity.inboxId]);
  const duration = Date.now() - startTime;
  
  operationStats.addMember++;
  events.emit('counter', 'operations.addMember', 1);
  events.emit('histogram', 'operation.addMember.duration', duration);
}

/**
 * Operation: Remove member from group
 */
async function opRemoveMember(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  // Get current members
  const members = await conversation.members();
  
  // Don't remove if only 2 members left
  if (members.length <= 2) {
    // Instead add a member
    await opAddMember(group, sender, events);
    return;
  }
  
  // Select a random member that's not the sender
  const removableMembers = members.filter(m => m.inboxId !== sender.inboxId);
  if (removableMembers.length === 0) {
    throw new Error('No removable members');
  }
  
  const targetMember = removableMembers[Math.floor(Math.random() * removableMembers.length)];
  
  const startTime = Date.now();
  await conversation.removeMembers([targetMember.inboxId]);
  const duration = Date.now() - startTime;
  
  operationStats.removeMember++;
  events.emit('counter', 'operations.removeMember', 1);
  events.emit('histogram', 'operation.removeMember.duration', duration);
}

/**
 * Operation: Add admin
 */
async function opAddAdmin(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  // Get current members who are not admins
  const members = await conversation.members();
  const nonAdminMembers = members.filter(m => !conversation.isAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  
  if (nonAdminMembers.length === 0) {
    // No one to promote, skip
    return;
  }
  
  const targetMember = nonAdminMembers[Math.floor(Math.random() * nonAdminMembers.length)];
  
  const startTime = Date.now();
  await conversation.addAdmin(targetMember.inboxId);
  const duration = Date.now() - startTime;
  
  operationStats.addAdmin++;
  events.emit('counter', 'operations.addAdmin', 1);
  events.emit('histogram', 'operation.addAdmin.duration', duration);
}

/**
 * Operation: Remove admin
 */
async function opRemoveAdmin(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  // Get current admins (not super admins)
  const admins = conversation.admins.filter(adminId => !conversation.isSuperAdmin(adminId));
  
  if (admins.length === 0) {
    // No admins to remove
    return;
  }
  
  const targetAdmin = admins[Math.floor(Math.random() * admins.length)];
  
  const startTime = Date.now();
  await conversation.removeAdmin(targetAdmin);
  const duration = Date.now() - startTime;
  
  operationStats.removeAdmin++;
  events.emit('counter', 'operations.removeAdmin', 1);
  events.emit('histogram', 'operation.removeAdmin.duration', duration);
}

/**
 * Operation: Add super admin
 */
async function opAddSuperAdmin(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  // Get current members who are not super admins
  const members = await conversation.members();
  const nonSuperAdminMembers = members.filter(m => !conversation.isSuperAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  
  if (nonSuperAdminMembers.length === 0) {
    // No one to promote
    return;
  }
  
  const targetMember = nonSuperAdminMembers[Math.floor(Math.random() * nonSuperAdminMembers.length)];
  
  const startTime = Date.now();
  await conversation.addSuperAdmin(targetMember.inboxId);
  const duration = Date.now() - startTime;
  
  operationStats.addSuperAdmin++;
  events.emit('counter', 'operations.addSuperAdmin', 1);
  events.emit('histogram', 'operation.addSuperAdmin.duration', duration);
}

/**
 * Operation: Remove super admin
 */
async function opRemoveSuperAdmin(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  // Get current super admins (don't remove self)
  const superAdmins = conversation.superAdmins.filter(adminId => adminId !== sender.inboxId);
  
  if (superAdmins.length === 0) {
    // No super admins to remove
    return;
  }
  
  const targetSuperAdmin = superAdmins[Math.floor(Math.random() * superAdmins.length)];
  
  const startTime = Date.now();
  await conversation.removeSuperAdmin(targetSuperAdmin);
  const duration = Date.now() - startTime;
  
  operationStats.removeSuperAdmin++;
  events.emit('counter', 'operations.removeSuperAdmin', 1);
  events.emit('histogram', 'operation.removeSuperAdmin.duration', duration);
}

/**
 * Operation: Sync group
 */
async function opSync(group: GroupInfo, sender: TestIdentity, events: any): Promise<void> {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  
  const startTime = Date.now();
  await conversation.sync();
  const duration = Date.now() - startTime;
  
  operationStats.sync++;
  events.emit('counter', 'operations.sync', 1);
  events.emit('histogram', 'operation.sync.duration', duration);
}

/**
 * Log throughput metrics periodically
 */
function logMetrics() {
  const now = Date.now();
  const elapsed = (now - lastLogTime) / 1000;
  
  if (elapsed >= 10) {  // Log every 10 seconds
    const rate = operationsThisSecond / elapsed;
    const totalOps = Object.values(operationStats).reduce((sum, val) => 
      typeof val === 'number' ? sum + val : sum, 0
    );
    console.log(`[Worker ${process.pid}] Rate: ${rate.toFixed(2)} ops/s | Total: ${totalOps} operations`);
    console.log(`[Worker ${process.pid}] Stats: ${JSON.stringify(operationStats)}`);
    lastLogTime = now;
    operationsThisSecond = 0;
  }
}

/**
 * Main operation execution function called by Artillery
 */
export async function sendMessage(userContext: any, events: any, done?: Function) {
  try {
    // Load config on first run
    if (!config || !workloadMix) {
      loadConfig();
    }
    
    // Select operation based on workload mix
    const operation = selectOperation(workloadMix!);
    
    // Select a random group
    const group = selectRandomGroup();
    
    // Select a random sender from that group
    const sender = selectSenderForGroup(group);
    
    // Execute the selected operation
    switch (operation) {
      case 'sendMessage':
        await opSendMessage(group, sender, events);
        break;
      case 'updateName':
        await opUpdateName(group, sender, events);
        break;
      case 'updateDescription':
        await opUpdateDescription(group, sender, events);
        break;
      case 'updateImageUrl':
        await opUpdateImageUrl(group, sender, events);
        break;
      case 'addMember':
        await opAddMember(group, sender, events);
        break;
      case 'removeMember':
        await opRemoveMember(group, sender, events);
        break;
      case 'addAdmin':
        await opAddAdmin(group, sender, events);
        break;
      case 'removeAdmin':
        await opRemoveAdmin(group, sender, events);
        break;
      case 'addSuperAdmin':
        await opAddSuperAdmin(group, sender, events);
        break;
      case 'removeSuperAdmin':
        await opRemoveSuperAdmin(group, sender, events);
        break;
      case 'sync':
        await opSync(group, sender, events);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    // Track metrics
    operationsThisSecond++;
    
    // Report to Artillery
    events.emit('counter', 'operations.total', 1);
    
    // Log periodic metrics
    logMetrics();
    
    if (done) done();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker ${process.pid}] Error executing operation:`, errorMsg);
    
    // Track error
    if (!operationStats.errors[errorMsg]) {
      operationStats.errors[errorMsg] = 0;
    }
    operationStats.errors[errorMsg]++;
    
    events.emit('counter', 'operations.failed', 1);
    if (done) done(error);
    else throw error;
  }
}

/**
 * Initialize worker - called once per worker process
 */
export async function beforeScenario(userContext: any, events: any, done?: Function) {
  console.log(`[Worker ${process.pid}] Initializing...`);
  try {
    loadConfig();
    if (done) done();
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to initialize:`, error);
    if (done) done(error);
    else throw error;
  }
}

/**
 * Cleanup worker - called when worker is shutting down
 */
export async function afterScenario(userContext: any, events: any, done?: Function) {
  const totalOps = Object.values(operationStats).reduce((sum, val) => 
    typeof val === 'number' ? sum + val : sum, 0
  );
  
  console.log(`[Worker ${process.pid}] Shutting down... Executed ${totalOps} operations`);
  console.log(`[Worker ${process.pid}] Final stats:`, JSON.stringify(operationStats, null, 2));
  
  // Save stats to file
  try {
    const statsFile = `./data/worker-${process.pid}-stats.json`;
    writeFileSync(statsFile, JSON.stringify(operationStats, null, 2));
    console.log(`[Worker ${process.pid}] Saved stats to ${statsFile}`);
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to save stats:`, error);
  }
  
  // Close all clients
  for (const [inboxId, client] of clients.entries()) {
    try {
      // XMTP clients don't have an explicit close method in the current SDK
      // The clients will be garbage collected
      console.log(`[Worker ${process.pid}] Cleaned up client ${inboxId.slice(0, 8)}`);
    } catch (error) {
      console.error(`[Worker ${process.pid}] Error cleaning up client:`, error);
    }
  }
  
  clients.clear();
  if (done) done();
}

// Export for Artillery
export default {
  sendMessage,
  beforeScenario,
  afterScenario,
};


