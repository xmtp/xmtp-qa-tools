/**
 * XMTP Load Test Artillery Processor
 * 
 * This processor handles the actual message sending during the load test.
 * It manages XMTP clients, distributes load across groups, and tracks metrics.
 */

import { Client } from "@xmtp/node-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { createSigner, encryptionKeyFromHex } from "./xmtp-helpers";

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
  createdAt: string;
  config: {
    numIdentities: number;
    numGroups: number;
    membersPerGroup: number;
    env: string;
  };
}

// Global state - initialized once per worker
let config: LoadTestConfig | null = null;
let clients: Map<string, Client> = new Map();
let messageCounter = 0;
let lastLogTime = Date.now();
let messagesThisSecond = 0;

/**
 * Load configuration from disk
 */
function loadConfig(): LoadTestConfig {
  if (config) return config;
  
  const configPath = process.env.CONFIG_PATH || "./data/load-test-config.json";
  const configData = readFileSync(configPath, "utf-8");
  config = JSON.parse(configData);
  
  console.log(`[Worker ${process.pid}] Loaded config: ${config!.identities.length} identities, ${config!.groups.length} groups`);
  
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
 * Log throughput metrics periodically
 */
function logMetrics() {
  const now = Date.now();
  const elapsed = (now - lastLogTime) / 1000;
  
  if (elapsed >= 10) {  // Log every 10 seconds
    const rate = messagesThisSecond / elapsed;
    console.log(`[Worker ${process.pid}] Rate: ${rate.toFixed(2)} msg/s | Total: ${messageCounter} messages`);
    lastLogTime = now;
    messagesThisSecond = 0;
  }
}

/**
 * Main message sending function called by Artillery
 */
export async function sendMessage(userContext: any, events: any, done?: Function) {
  try {
    // Load config on first run
    if (!config) {
      loadConfig();
    }
    
    // Select a random group
    const group = selectRandomGroup();
    
    // Select a random sender from that group
    const sender = selectSenderForGroup(group);
    
    // Get or create client
    const client = await getClient(sender);
    
    // Get the conversation
    const conversation = await client.conversations.getConversationById(group.id);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${group.id}`);
    }
    
    // Send message
    const messageText = `Load test message ${messageCounter} from ${sender.accountAddress.slice(0, 8)} at ${new Date().toISOString()}`;
    
    const startTime = Date.now();
    await conversation.send(messageText);
    const duration = Date.now() - startTime;
    
    // Track metrics
    messageCounter++;
    messagesThisSecond++;
    
    // Report to Artillery
    events.emit('counter', 'messages.sent', 1);
    events.emit('histogram', 'message.send.duration', duration);
    
    // Log periodic metrics
    logMetrics();
    
    if (done) done();
  } catch (error) {
    console.error(`[Worker ${process.pid}] Error sending message:`, error);
    events.emit('counter', 'messages.failed', 1);
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
  console.log(`[Worker ${process.pid}] Shutting down... Sent ${messageCounter} messages`);
  
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


