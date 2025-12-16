#!/usr/bin/env tsx
/**
 * Auto-tune Artillery Configuration
 * 
 * Analyzes system resources and generates optimal Artillery config
 */

import { freemem, totalmem, cpus } from "os";
import { writeFileSync, existsSync, readFileSync } from "fs";

interface SystemResources {
  totalMemMB: number;
  freeMemMB: number;
  cpuCores: number;
}

function getSystemResources(): SystemResources {
  return {
    totalMemMB: Math.floor(totalmem() / (1024 * 1024)),
    freeMemMB: Math.floor(freemem() / (1024 * 1024)),
    cpuCores: cpus().length,
  };
}

function calculateOptimalConfig(resources: SystemResources) {
  // Conservative estimates to avoid OOM
  const memoryPerWorker = 200; // MB per worker process
  const maxWorkers = Math.floor((resources.freeMemMB * 0.7) / memoryPerWorker);
  const workers = Math.min(Math.max(2, maxWorkers), resources.cpuCores * 2);
  
  // Calculate throughput based on workers
  const opsPerWorkerPerSecond = 5;
  const targetRate = workers * opsPerWorkerPerSecond;
  
  return {
    workers,
    arrivalRate: targetRate,
    warmupDuration: 60,
    sustainedDuration: 3600, // 1 hour
    cooldownDuration: 60,
  };
}

function generateArtilleryConfig(config: any) {
  return `config:
  target: "xmtp://load-test"
  
  phases:
    # Warm-up
    - duration: ${config.warmupDuration}
      arrivalRate: ${Math.floor(config.arrivalRate * 0.2)}
      rampTo: ${config.arrivalRate}
      name: "Warm-up"
    
    # Sustained load
    - duration: ${config.sustainedDuration}
      arrivalRate: ${config.arrivalRate}
      name: "Sustained Load"
    
    # Cool-down
    - duration: ${config.cooldownDuration}
      arrivalRate: ${config.arrivalRate}
      rampTo: ${Math.floor(config.arrivalRate * 0.2)}
      name: "Cool-down"
  
  processor: "./dist/artillery-processor.js"
  
  pool: ${config.workers}
  
  ensure:
    maxErrorRate: 5

scenarios:
  - name: "Send XMTP Operations"
    flow:
      - function: "sendMessage"

plugins:
  expect: {}
  metrics-by-endpoint:
    stripQueryString: true
`;
}

function main() {
  console.log("🔧 Auto-tuning Artillery configuration...\n");
  
  // Check if config exists
  if (!existsSync("./data/load-test-config.json")) {
    console.error("❌ Load test config not found. Run 'npm run setup' first.");
    process.exit(1);
  }
  
  const resources = getSystemResources();
  
  console.log("📊 System Resources:");
  console.log(`   Total Memory: ${resources.totalMemMB}MB`);
  console.log(`   Free Memory: ${resources.freeMemMB}MB`);
  console.log(`   CPU Cores: ${resources.cpuCores}`);
  console.log();
  
  const config = calculateOptimalConfig(resources);
  
  console.log("⚙️  Recommended Configuration:");
  console.log(`   Workers: ${config.workers}`);
  console.log(`   Arrival Rate: ${config.arrivalRate} ops/s`);
  console.log(`   Warm-up: ${config.warmupDuration}s`);
  console.log(`   Duration: ${config.sustainedDuration}s`);
  console.log(`   Cool-down: ${config.cooldownDuration}s`);
  console.log();
  
  const artilleryConfig = generateArtilleryConfig(config);
  writeFileSync("./artillery-config-auto.yml", artilleryConfig);
  
  console.log("✅ Generated: artillery-config-auto.yml");
  console.log("\nRun with: npm run test:auto");
}

main();
