#!/usr/bin/env tsx
/**
 * XMTP Load Test Setup Script
 * 
 * This script prepares the environment for load testing by:
 * 1. Creating N test identities (XMTP clients)
 * 2. Creating M group chats
 * 3. Distributing identities across groups
 * 4. Saving all configuration to disk for the load test
 */

import { Command } from "commander";
import { Client } from "@xmtp/node-sdk";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createUser, createSigner, generateEncryptionKey } from "./xmtp-helpers";

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
    apiUrl?: string;
  };
}

const program = new Command();

program
  .name("setup")
  .description("Setup XMTP load test environment")
  .requiredOption("-i, --identities <number>", "Number of identities to create", parseInt)
  .requiredOption("-g, --groups <number>", "Number of groups to create", parseInt)
  .requiredOption("-m, --members <number>", "Members per group", parseInt)
  .option("-e, --env <environment>", "XMTP environment (dev|production|local)", "dev")
  .option("-a, --api-url <url>", "Custom API URL", "https://grpc.testnet-staging.xmtp.network:443")
  .option("-o, --output <path>", "Output directory for config", "./data")
  .parse();

const options = program.opts();

async function createTestIdentity(env: string, apiUrl?: string): Promise<TestIdentity> {
  const user = createUser();
  const signer = createSigner(user);
  const encryptionKey = generateEncryptionKey();
  
  const clientOptions: any = {
    env: env as any,
    dbEncryptionKey: Buffer.from(encryptionKey, "hex"),
  };
  
  if (apiUrl) {
    clientOptions.apiUrl = apiUrl;
  }
  
  const client = await Client.create(signer, clientOptions);
  
  const identity: TestIdentity = {
    accountAddress: user.account.address,
    privateKey: user.key,
    encryptionKey,
    inboxId: client.inboxId,
    installationId: client.installationId,
  };
  
  console.log(`✓ Created identity: ${identity.accountAddress} (inbox: ${identity.inboxId.slice(0, 8)}...)`);
  
  return identity;
}

async function setupLoadTest() {
  console.log("🚀 XMTP Load Test Setup");
  console.log("=".repeat(60));
  console.log(`Identities: ${options.identities}`);
  console.log(`Groups: ${options.groups}`);
  console.log(`Members per group: ${options.members}`);
  console.log(`Environment: ${options.env}`);
  if (options.apiUrl) {
    console.log(`API URL: ${options.apiUrl}`);
  }
  console.log(`Output: ${options.output}`);
  console.log("=".repeat(60));
  console.log();

  // Validation
  if (options.identities < 2) {
    console.error("❌ Error: Need at least 2 identities");
    process.exit(1);
  }
  
  if (options.groups < 1) {
    console.error("❌ Error: Need at least 1 group");
    process.exit(1);
  }
  
  if (options.members < 2) {
    console.error("❌ Error: Need at least 2 members per group");
    process.exit(1);
  }
  
  if (options.members > options.identities) {
    console.error("❌ Error: Members per group cannot exceed total identities");
    process.exit(1);
  }

  // Create output directory
  if (!existsSync(options.output)) {
    mkdirSync(options.output, { recursive: true });
  }

  const startTime = Date.now();

  // Step 1: Create identities
  console.log(`\n📝 Step 1: Creating ${options.identities} identities...`);
  const identities: TestIdentity[] = [];
  
  for (let i = 0; i < options.identities; i++) {
    const identity = await createTestIdentity(options.env, options.apiUrl);
    identities.push(identity);
    
    if ((i + 1) % 10 === 0) {
      console.log(`   Progress: ${i + 1}/${options.identities}`);
    }
  }
  
  console.log(`✅ Created ${identities.length} identities in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Step 2: Create groups
  console.log(`\n🔗 Step 2: Creating ${options.groups} groups...`);
  const groups: GroupInfo[] = [];
  
  // Distribute identities across groups
  // Strategy: Round-robin assignment to ensure even distribution
  const groupMemberships: string[][] = Array.from({ length: options.groups }, () => []);
  
  for (let i = 0; i < options.identities; i++) {
    const groupIndex = i % options.groups;
    groupMemberships[groupIndex].push(identities[i].inboxId);
  }
  
  // Create each group with its members
  for (let i = 0; i < options.groups; i++) {
    const memberInboxIds = groupMemberships[i].slice(0, options.members);
    
    if (memberInboxIds.length < 2) {
      console.warn(`⚠️  Group ${i} would have < 2 members, skipping`);
      continue;
    }
    
    // Get the first member's client to create the group
    const firstMember = identities.find(id => id.inboxId === memberInboxIds[0]);
    if (!firstMember) continue;
    
    const signer = createSigner(firstMember.privateKey);
    
    const clientOptions: any = {
      env: options.env as any,
      dbEncryptionKey: Buffer.from(firstMember.encryptionKey, "hex"),
    };
    
    if (options.apiUrl) {
      clientOptions.apiUrl = options.apiUrl;
    }
    
    const client = await Client.create(signer, clientOptions);
    
    // Create the group
    const group = await client.conversations.newGroup(
      memberInboxIds.slice(1), // Don't include creator in the add list
      {
        groupName: `Load Test Group ${i + 1}`,
        groupDescription: `XMTP load test group with ${memberInboxIds.length} members`,
      }
    );
    
    groups.push({
      id: group.id,
      name: `Load Test Group ${i + 1}`,
      memberInboxIds,
    });
    
    console.log(`✓ Created group ${i + 1}: ${group.id.slice(0, 16)}... (${memberInboxIds.length} members)`);
    
    if ((i + 1) % 5 === 0) {
      console.log(`   Progress: ${i + 1}/${options.groups}`);
    }
  }
  
  console.log(`✅ Created ${groups.length} groups in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Step 3: Save configuration
  console.log(`\n💾 Step 3: Saving configuration...`);
  
  const config: LoadTestConfig = {
    identities,
    groups,
    createdAt: new Date().toISOString(),
    config: {
      numIdentities: options.identities,
      numGroups: options.groups,
      membersPerGroup: options.members,
      env: options.env,
      apiUrl: options.apiUrl,
    },
  };
  
  const configPath = join(options.output, "load-test-config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✓ Saved configuration to: ${configPath}`);
  
  // Also save a summary
  const summary = {
    totalIdentities: identities.length,
    totalGroups: groups.length,
    avgMembersPerGroup: (groups.reduce((sum, g) => sum + g.memberInboxIds.length, 0) / groups.length).toFixed(1),
    environment: options.env,
    createdAt: config.createdAt,
    setupDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  };
  
  const summaryPath = join(options.output, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary to: ${summaryPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ Setup Complete!");
  console.log("=".repeat(60));
  console.log(`Total identities: ${summary.totalIdentities}`);
  console.log(`Total groups: ${summary.totalGroups}`);
  console.log(`Avg members/group: ${summary.avgMembersPerGroup}`);
  console.log(`Setup time: ${summary.setupDuration}`);
  console.log("\n🚀 Ready for load testing! Run: npm run test");
  console.log("=".repeat(60));
}

// Run the setup
setupLoadTest().catch((error) => {
  console.error("\n❌ Setup failed:", error);
  process.exit(1);
});


