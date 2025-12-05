#!/usr/bin/env tsx
/**
 * Simple TypeScript-based load test runner (no Artillery dependency)
 * 
 * This is an alternative to Artillery for simpler scenarios or debugging.
 * Run with: tsx run-simple.ts
 */

import { Client } from "@xmtp/node-sdk";
import { readFileSync, existsSync } from "fs";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { createSigner } from "./xmtp-helpers";

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
  };
}

// Configuration
const CONFIG = {
  configPath: "./data/load-test-config.json",
  targetRate: 60, // messages per second
  duration: 60, // seconds
  concurrency: cpus().length, // number of parallel workers
};

async function runLoadTest() {
  console.log("🚀 XMTP Simple Load Test");
  console.log("=".repeat(60));
  console.log(`Target rate: ${CONFIG.targetRate} msg/s`);
  console.log(`Duration: ${CONFIG.duration}s`);
  console.log(`Concurrency: ${CONFIG.concurrency}`);
  console.log("=".repeat(60));

  // Load config
  if (!existsSync(CONFIG.configPath)) {
    console.error("❌ Config not found. Run 'npm run setup' first.");
    process.exit(1);
  }

  const config: LoadTestConfig = JSON.parse(readFileSync(CONFIG.configPath, "utf-8"));
  console.log(`✓ Loaded ${config.identities.length} identities, ${config.groups.length} groups`);

  // Create clients for all identities
  console.log("\n📡 Creating XMTP clients...");
  const clients = new Map<string, Client>();
  
  for (const identity of config.identities) {
    try {
      const signer = createSigner(identity.privateKey);
      
      const clientOptions: any = {
        env: config.config.env as any,
        dbEncryptionKey: new Uint8Array(Buffer.from(identity.encryptionKey, "hex")),
        dbPath: `./data/dbs/${identity.inboxId.slice(0, 8)}.db3`,
      };
      
      if (config.config.apiUrl) {
        clientOptions.apiUrl = config.config.apiUrl;
      }
      
      const client = await Client.create(signer, clientOptions);
      
      clients.set(identity.inboxId, client);
    } catch (error) {
      console.error(`❌ Failed to create client for ${identity.accountAddress}:`, error);
    }
  }
  
  console.log(`✅ Created ${clients.size} clients`);

  // Start sending messages
  console.log("\n🔥 Starting load test...\n");
  
  let messagesSent = 0;
  let messagesFailed = 0;
  const startTime = Date.now();
  const endTime = startTime + (CONFIG.duration * 1000);
  const intervalMs = 1000 / CONFIG.targetRate;
  
  let lastLogTime = startTime;
  let messagesSinceLastLog = 0;

  async function sendMessage() {
    try {
      // Select random group
      const group = config.groups[Math.floor(Math.random() * config.groups.length)];
      
      // Select random sender from group
      const memberIdentities = config.identities.filter(
        id => group.memberInboxIds.includes(id.inboxId)
      );
      const sender = memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
      
      // Get client
      const client = clients.get(sender.inboxId);
      if (!client) {
        throw new Error("Client not found");
      }
      
      // Get conversation
      const conversation = await client.conversations.getConversationById(group.id);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      
      // Send message
      const messageText = `Load test message ${messagesSent} from ${sender.accountAddress.slice(0, 8)}`;
      await conversation.send(messageText);
      
      messagesSent++;
      messagesSinceLastLog++;
      
      // Log every second
      const now = Date.now();
      if (now - lastLogTime >= 1000) {
        const actualRate = messagesSinceLastLog / ((now - lastLogTime) / 1000);
        console.log(`[${((now - startTime) / 1000).toFixed(0)}s] Sent: ${messagesSent} | Rate: ${actualRate.toFixed(2)} msg/s | Failed: ${messagesFailed}`);
        lastLogTime = now;
        messagesSinceLastLog = 0;
      }
    } catch (error) {
      messagesFailed++;
      console.error("❌ Error:", error instanceof Error ? error.message : error);
    }
  }

  // Main loop
  while (Date.now() < endTime) {
    const promises = [];
    for (let i = 0; i < CONFIG.concurrency; i++) {
      promises.push(sendMessage());
    }
    await Promise.allSettled(promises);
    
    // Wait for next interval
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  // Final report
  const totalDuration = (Date.now() - startTime) / 1000;
  const actualRate = messagesSent / totalDuration;
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Load Test Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${totalDuration.toFixed(1)}s`);
  console.log(`Messages sent: ${messagesSent}`);
  console.log(`Messages failed: ${messagesFailed}`);
  console.log(`Actual rate: ${actualRate.toFixed(2)} msg/s`);
  console.log(`Success rate: ${((messagesSent / (messagesSent + messagesFailed)) * 100).toFixed(2)}%`);
  console.log("=".repeat(60));
}

runLoadTest().catch(error => {
  console.error("\n❌ Load test failed:", error);
  process.exit(1);
});


