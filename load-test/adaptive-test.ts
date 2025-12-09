#!/usr/bin/env tsx
/**
 * Adaptive Load Tester - Automatically ramps up until hitting memory limits
 * 
 * This pushes the system to max capacity without crashing
 */

import { Client } from "@xmtp/node-sdk";
import { readFileSync, existsSync } from "fs";
import { freemem, totalmem } from "os";
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
  config: {
    env: string;
    apiUrl?: string;
    d14nHost?: string;
  };
}

// Configuration
const MIN_FREE_MEMORY_MB = 200;  // Stop ramping when we hit this
const MEMORY_CHECK_INTERVAL_MS = 5000;  // Check memory every 5s
const RAMP_UP_INTERVAL_MS = 10000;  // Increase load every 10s
const INITIAL_CONCURRENCY = 2;
const MAX_CONCURRENCY = 200;
const MESSAGES_PER_WORKER = 10;  // Each worker tries to send this many msg/s

let currentConcurrency = INITIAL_CONCURRENCY;
let messagesSent = 0;
let messagesFailed = 0;
let isRamping = true;
let clients: Map<string, Client> = new Map();

async function loadConfig(): Promise<LoadTestConfig> {
  const configPath = "./data/load-test-config.json";
  if (!existsSync(configPath)) {
    console.error("❌ Config not found. Run setup first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
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

async function sendMessage(config: LoadTestConfig): Promise<boolean> {
  try {
    // Select random group and sender
    const group = config.groups[Math.floor(Math.random() * config.groups.length)];
    const memberIdentities = config.identities.filter(
      id => group.memberInboxIds.includes(id.inboxId)
    );
    const sender = memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
    
    // Get client
    const client = await createClient(sender, config);
    
    // Get conversation and send
    const conversation = await client.conversations.getConversationById(group.id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${group.id}`);
    }
    
    await conversation.send(`Adaptive test msg ${messagesSent} at ${new Date().toISOString()}`);
    messagesSent++;
    return true;
  } catch (error) {
    messagesFailed++;
    return false;
  }
}

async function workerLoop(config: LoadTestConfig, workerId: number) {
  while (true) {
    // Send burst of messages
    const promises = [];
    for (let i = 0; i < MESSAGES_PER_WORKER; i++) {
      promises.push(sendMessage(config));
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
    
    console.log(`\n📊 Memory: ${mem.freeMemMB}MB free / ${mem.totalMemMB}MB total (${mem.usedPercent}% used)`);
    console.log(`⚡ Load: ${currentConcurrency} workers | Sent: ${messagesSent} | Failed: ${messagesFailed} | Rate: ${(messagesSent / ((Date.now() - startTime) / 1000)).toFixed(1)} msg/s`);
    
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
  
  console.log("\n\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`Messages sent: ${messagesSent}`);
  console.log(`Messages failed: ${messagesFailed}`);
  console.log(`Success rate: ${((messagesSent / (messagesSent + messagesFailed)) * 100).toFixed(2)}%`);
  console.log(`Average rate: ${(messagesSent / duration).toFixed(1)} msg/s`);
  console.log(`Peak workers: ${currentConcurrency}`);
  console.log(`Final memory: ${mem.freeMemMB}MB free (${mem.usedPercent}% used)`);
  console.log("=".repeat(60));
  
  process.exit(0);
});

main().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});

