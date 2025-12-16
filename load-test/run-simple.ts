#!/usr/bin/env tsx
/**
 * Simple Load Test Runner
 * 
 * Basic test runner for development and debugging
 */

import { Client } from "@xmtp/node-sdk";
import { readFileSync, existsSync } from "fs";
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

const TARGET_RATE = 60; // messages per second
const DURATION_SECONDS = 60; // 1 minute
const CONCURRENCY = 2; // parallel workers

async function loadConfig(): Promise<LoadTestConfig> {
  const configPath = "./data/load-test-config.json";
  if (!existsSync(configPath)) {
    console.error("❌ Config not found. Run 'npm run setup' first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

async function sendMessage(
  config: LoadTestConfig,
  clients: Map<string, Client>
): Promise<boolean> {
  try {
    // Select random group
    const group = config.groups[Math.floor(Math.random() * config.groups.length)];
    
    // Select random sender from group members
    const memberIdentities = config.identities.filter(id =>
      group.memberInboxIds.includes(id.inboxId)
    );
    const sender = memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
    
    // Get or create client
    let client = clients.get(sender.inboxId);
    if (!client) {
      const signer = createSigner(sender.privateKey);
      
      const clientOptions: any = {
        env: config.config.env as any,
        dbEncryptionKey: encryptionKeyFromHex(sender.encryptionKey),
        dbPath: `./data/dbs/${sender.inboxId.slice(0, 8)}.db3`,
      };
      
      if (config.config.d14nHost) {
        clientOptions.d14nHost = config.config.d14nHost;
      } else if (config.config.apiUrl) {
        clientOptions.apiUrl = config.config.apiUrl;
      }
      
      client = await Client.create(signer, clientOptions);
      await client.conversations.sync();
      clients.set(sender.inboxId, client);
    }
    
    // Get conversation and send message
    const conversation = await client.conversations.getConversationById(group.id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${group.id}`);
    }
    
    await conversation.send(`Simple test message at ${new Date().toISOString()}`);
    return true;
  } catch (error) {
    console.error("Send error:", error);
    return false;
  }
}

async function worker(
  config: LoadTestConfig,
  workerId: number,
  stats: { sent: number; failed: number }
): Promise<void> {
  const clients = new Map<string, Client>();
  const startTime = Date.now();
  const endTime = startTime + DURATION_SECONDS * 1000;
  const messagesPerSecond = TARGET_RATE / CONCURRENCY;
  const intervalMs = 1000 / messagesPerSecond;
  
  while (Date.now() < endTime) {
    const success = await sendMessage(config, clients);
    if (success) {
      stats.sent++;
    } else {
      stats.failed++;
    }
    
    // Wait before next message
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  
  console.log(`[Worker ${workerId}] Finished`);
}

async function main() {
  console.log("🚀 XMTP Simple Load Test");
  console.log("=".repeat(60));
  console.log(`Target rate: ${TARGET_RATE} msg/s`);
  console.log(`Duration: ${DURATION_SECONDS}s`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log("=".repeat(60));
  console.log();
  
  const config = await loadConfig();
  console.log(
    `✓ Loaded ${config.identities.length} identities, ${config.groups.length} groups\n`
  );
  
  const stats = { sent: 0, failed: 0 };
  const startTime = Date.now();
  
  // Start workers
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(config, i, stats));
  }
  
  // Monitor progress
  const monitorInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = stats.sent / elapsed;
    console.log(
      `Progress: ${stats.sent} sent, ${stats.failed} failed | Rate: ${rate.toFixed(1)} msg/s`
    );
  }, 5000);
  
  // Wait for all workers
  await Promise.all(workers);
  clearInterval(monitorInterval);
  
  const duration = (Date.now() - startTime) / 1000;
  const actualRate = stats.sent / duration;
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`Messages sent: ${stats.sent}`);
  console.log(`Messages failed: ${stats.failed}`);
  console.log(`Average rate: ${actualRate.toFixed(1)} msg/s`);
  console.log(
    `Success rate: ${((stats.sent / (stats.sent + stats.failed)) * 100).toFixed(2)}%`
  );
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
