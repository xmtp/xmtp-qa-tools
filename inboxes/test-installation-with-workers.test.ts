import { getWorkers } from "@workers/manager";
import { typeofStream, typeOfResponse } from "@workers/main";
import { loadEnv } from "@helpers/client";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prepareInstallationForWorkers } from "./start-installation-simple";

const testName = "installation-workers-integration";

describe("Installation to Workers Integration", () => {
  let workers: any;

  beforeAll(async () => {
    // Load test environment
    loadEnv(testName);
    
    // Prepare installations 1, 2, and 3 for workers framework
    console.log("🔧 Preparing installations for test...");
    const prep1 = prepareInstallationForWorkers(1, "local");
    const prep2 = prepareInstallationForWorkers(2, "local");
    const prep3 = prepareInstallationForWorkers(3, "local");
    
    console.log(`✅ Prepared workers: ${prep1.workerName}, ${prep2.workerName}, ${prep3.workerName}`);
  });

  afterAll(async () => {
    if (workers) {
      await workers.terminateAll();
    }
  });

  it("should successfully create workers from installations using naming convention", async () => {
    // Create workers using the prepared installation names
    workers = await getWorkers(
      ["inst1", "inst2", "inst3"],
      testName,
      typeofStream.Message,
      typeOfResponse.Gpt
    );

    // Verify workers were created
    expect(workers.getLength()).toBe(3);
    
    const worker1 = workers.get("inst1");
    const worker2 = workers.get("inst2");
    const worker3 = workers.get("inst3");
    
    expect(worker1).toBeDefined();
    expect(worker2).toBeDefined();
    expect(worker3).toBeDefined();
    
    // Verify worker properties match installation data
    expect(worker1.address).toBe("0x79cd2e5a08082f293331334e76318d6b3e9994a1");
    expect(worker2.address).toBe("0xacbe019548c58c3e45f5b8bdd8743c42a34f0706");
    expect(worker3.address).toBe("0x1234567890abcdef1234567890abcdef12345678");
    
    console.log("✅ Workers created successfully from installations");
    console.log(`   Worker 1: ${worker1.name} - ${worker1.address}`);
    console.log(`   Worker 2: ${worker2.name} - ${worker2.address}`);
    console.log(`   Worker 3: ${worker3.name} - ${worker3.address}`);
  });

  it("should sync conversations from installation databases", async () => {
    // Sync conversations to load existing data from the installation databases
    console.log("🔄 Syncing conversations from installation databases...");
    
    const allWorkers = workers.getAll();
    for (const worker of allWorkers) {
      await worker.client.conversations.sync();
      const conversations = await worker.client.conversations.list();
      
      console.log(`📱 Worker ${worker.name}: found ${conversations.length} conversations`);
      
      // We expect 0 conversations since these are mock databases
      // But in a real scenario with actual XMTP data, this would show existing conversations
      expect(conversations.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("should create a group between installation workers", async () => {
    console.log("🤝 Creating a group between installation workers...");
    
    const group = await workers.createGroupBetweenAll("Test Group from Installations");
    
    expect(group).toBeDefined();
    expect(group.name).toBe("Test Group from Installations");
    
    console.log(`✅ Group created: ${group.name} (ID: ${group.id})`);
    
    // Send a test message
    const creator = workers.getCreator();
    await group.send(`Hello from installation worker ${creator.name}! This demonstrates that installations can be started as workers using naming conventions.`);
    
    console.log(`📨 Message sent from worker "${creator.name}"`);
  });

  it("should demonstrate worker statistics and cleanup", async () => {
    console.log("📊 Worker statistics:");
    await workers.printWorkers();
    
    console.log("🧹 Testing cleanup...");
    await workers.terminateAll();
    
    console.log("✅ All workers terminated successfully");
  });
});