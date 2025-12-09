#!/usr/bin/env tsx
/**
 * Auto-tune load test configuration based on system resources
 */

import { cpus, freemem, totalmem } from "os";
import { writeFileSync, readFileSync, existsSync } from "fs";

interface SystemResources {
  cpuCores: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  recommendedWorkers: number;
  recommendedArrivalRate: number;
  recommendedIdentities: number;
  recommendedGroups: number;
}

function detectSystemResources(): SystemResources {
  const cpuCores = cpus().length;
  const totalMemoryGB = Math.floor(totalmem() / (1024 ** 3));
  const freeMemoryGB = Math.floor(freemem() / (1024 ** 3));
  
  // Conservative tuning to leave headroom for system
  const recommendedWorkers = Math.max(2, Math.floor(cpuCores * 0.75));
  
  // Estimate: ~10 msg/s per worker safely
  const recommendedArrivalRate = recommendedWorkers * 10;
  
  // Estimate: ~100MB per identity, leave 2GB for system
  const maxIdentities = Math.max(10, Math.floor((totalMemoryGB - 2) * 10));
  const recommendedIdentities = Math.min(100, maxIdentities);
  
  // Groups: ~20% of identities
  const recommendedGroups = Math.max(2, Math.floor(recommendedIdentities / 5));
  
  return {
    cpuCores,
    totalMemoryGB,
    freeMemoryGB,
    recommendedWorkers,
    recommendedArrivalRate,
    recommendedIdentities,
    recommendedGroups,
  };
}

function generateAutoTunedConfig(resources: SystemResources, duration: number = 60): string {
  return `config:
  target: "xmtp://load-test"
  
  # Auto-tuned for your system (${resources.cpuCores} cores, ${resources.totalMemoryGB}GB RAM)
  phases:
    - duration: ${duration}
      arrivalRate: ${resources.recommendedArrivalRate}
      name: "Auto-tuned Load"
  
  # Artillery processor
  processor: "./artillery-processor.cjs"
  
  # Auto-tuned worker pool (75% of cores)
  pool: ${resources.recommendedWorkers}
  
  # Performance tuning
  ensure:
    maxErrorRate: 15

# Scenario
scenarios:
  - name: "Send XMTP Messages"
    flow:
      - function: "sendMessage"

# Plugins
plugins:
  expect: {}
  metrics-by-endpoint:
    stripQueryString: true
`;
}

async function main() {
  console.log("🔧 Auto-tuning load test for your system...\n");
  
  const resources = detectSystemResources();
  
  console.log("📊 System Resources:");
  console.log(`  CPU Cores: ${resources.cpuCores}`);
  console.log(`  Total Memory: ${resources.totalMemoryGB}GB`);
  console.log(`  Free Memory: ${resources.freeMemoryGB}GB`);
  console.log();
  
  console.log("⚙️  Recommended Configuration:");
  console.log(`  Workers: ${resources.recommendedWorkers} (75% of cores)`);
  console.log(`  Arrival Rate: ${resources.recommendedArrivalRate} msg/s`);
  console.log(`  Identities: ${resources.recommendedIdentities}`);
  console.log(`  Groups: ${resources.recommendedGroups}`);
  console.log();
  
  // Check if we have enough resources
  if (resources.freeMemoryGB < 2) {
    console.log("⚠️  WARNING: Low free memory (< 2GB)!");
    console.log("   Consider reducing identities or closing other applications.");
    console.log();
  }
  
  if (resources.cpuCores < 4) {
    console.log("⚠️  WARNING: Low CPU cores (< 4)!");
    console.log("   Performance may be limited.");
    console.log();
  }
  
  // Generate auto-tuned config
  const config = generateAutoTunedConfig(resources);
  writeFileSync("./artillery-config-auto.yml", config);
  console.log("✅ Generated: artillery-config-auto.yml");
  console.log();
  
  // Check if setup is needed
  const configExists = existsSync("./data/load-test-config.json");
  
  if (!configExists) {
    console.log("📝 Setup Required:");
    console.log(`   npx tsx setup.ts -i ${resources.recommendedIdentities} -g ${resources.recommendedGroups} -m 10 -e dev`);
    console.log();
  }
  
  console.log("🚀 Run the auto-tuned test:");
  console.log("   npm run test:auto");
  console.log();
  
  console.log("💡 Tips:");
  console.log("   - Monitor system: htop or top");
  console.log("   - Watch logs: tail -f logs/*");
  console.log("   - Stop early: Ctrl+C anytime");
  console.log();
  
  // Estimated throughput
  const estimatedMsgs = resources.recommendedArrivalRate * 60;
  console.log(`📈 Estimated: ~${estimatedMsgs.toLocaleString()} messages in 1 minute`);
}

main().catch(console.error);

