#!/usr/bin/env tsx

/**
 * Test script to demonstrate starting installations using the workers framework
 * 
 * Usage:
 *   npx tsx inboxes/test-installation-startup.ts
 * 
 * This script shows how to:
 * 1. List available installations
 * 2. Start a specific installation as a worker
 * 3. Start multiple installations as workers
 * 4. Create groups between installation workers
 */

import { listInstallations, startInstallation, startInstallations } from "./start-installation";

async function main() {
  console.log("🎯 XMTP Installation Startup Test");
  console.log("=" .repeat(50));
  
  try {
    // Step 1: List available installations
    console.log("\n1️⃣ Listing available installations:");
    listInstallations();
    
    // Step 2: Start a single installation
    console.log("\n2️⃣ Starting installation 1 as a worker:");
    const worker = await startInstallation(1, "test-single-installation");
    
    console.log(`\n✅ Single worker started successfully!`);
    console.log(`   Worker name: ${worker.name}`);
    console.log(`   Inbox ID: ${worker.inboxId}`);
    console.log(`   Address: ${worker.address}`);
    
    // Step 3: Start multiple installations
    console.log("\n3️⃣ Starting installations 2, 3, and 4 as workers:");
    const workers = await startInstallations([2, 3, 4], "test-multi-installation");
    
    console.log(`\n✅ Multiple workers started successfully!`);
    workers.getAll().forEach(w => {
      console.log(`   Worker: ${w.name} - ${w.address}`);
    });
    
    // Step 4: Create a group between workers
    console.log("\n4️⃣ Creating a group between all workers:");
    const group = await workers.createGroupBetweenAll("Test Group from Installations");
    
    console.log(`\n✅ Group created successfully!`);
    console.log(`   Group name: ${group.name}`);
    console.log(`   Group ID: ${group.id}`);
    
    // Step 5: Send a test message
    console.log("\n5️⃣ Sending a test message:");
    const creator = workers.getCreator();
    await group.send(`Hello! This message was sent from installation worker "${creator.name}" using the workers framework. The installation has ${creator.worker ? 'pre-existing' : 'no'} conversation data.`);
    
    console.log(`✅ Message sent from worker "${creator.name}"`);
    
    // Step 6: Show worker statistics
    console.log("\n6️⃣ Worker statistics:");
    await workers.printWorkers();
    
    // Cleanup
    console.log("\n🧹 Cleaning up workers...");
    await workers.terminateAll();
    
    console.log("\n🎉 Test completed successfully!");
    console.log("\nKey findings:");
    console.log("- ✅ Installations can be mapped to workers using naming conventions");
    console.log("- ✅ Workers framework correctly loads installation data");
    console.log("- ✅ Multiple installations can work together");
    console.log("- ✅ Groups can be created between installation workers");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Handle cleanup on process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});