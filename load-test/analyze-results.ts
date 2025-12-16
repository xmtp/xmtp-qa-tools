#!/usr/bin/env tsx
/**
 * Analyze Load Test Results
 * 
 * Aggregates statistics from all worker processes and generates a summary report
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

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

function aggregateStats(dataDir: string = "./data"): OperationStats {
  const files = readdirSync(dataDir);
  const statFiles = files.filter(f => f.startsWith('worker-') && f.endsWith('-stats.json'));
  
  const aggregated: OperationStats = {
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
  
  console.log(`Found ${statFiles.length} worker stat files`);
  
  for (const file of statFiles) {
    try {
      const filePath = join(dataDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const stats: OperationStats = JSON.parse(content);
      
      // Aggregate all numeric stats
      for (const [key, value] of Object.entries(stats)) {
        if (key === 'errors') {
          // Merge errors
          for (const [errorKey, errorCount] of Object.entries(value as Record<string, number>)) {
            if (!aggregated.errors[errorKey]) {
              aggregated.errors[errorKey] = 0;
            }
            aggregated.errors[errorKey] += errorCount;
          }
        } else if (typeof value === 'number') {
          (aggregated as any)[key] += value;
        }
      }
    } catch (error) {
      console.warn(`Failed to read ${file}:`, error);
    }
  }
  
  return aggregated;
}

function generateReport(stats: OperationStats): void {
  const totalOps = Object.entries(stats)
    .filter(([key]) => key !== 'errors')
    .reduce((sum, [_, value]) => sum + (typeof value === 'number' ? value : 0), 0);
  
  const totalErrors = Object.values(stats.errors).reduce((sum, count) => sum + count, 0);
  
  console.log("\n" + "=".repeat(60));
  console.log("Load Test Results Summary");
  console.log("=".repeat(60));
  console.log(`\nTotal Operations: ${totalOps.toLocaleString()}`);
  console.log(`Total Errors: ${totalErrors.toLocaleString()}`);
  console.log(`Success Rate: ${((totalOps / (totalOps + totalErrors)) * 100).toFixed(2)}%`);
  
  console.log("\n" + "-".repeat(60));
  console.log("Operations Breakdown:");
  console.log("-".repeat(60));
  
  // Sort operations by count
  const operations = Object.entries(stats)
    .filter(([key]) => key !== 'errors')
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  
  for (const [operation, count] of operations) {
    const percentage = totalOps > 0 ? ((count as number / totalOps) * 100).toFixed(2) : '0.00';
    console.log(`  ${operation.padEnd(20)} ${(count as number).toLocaleString().padStart(10)} (${percentage}%)`);
  }
  
  if (totalErrors > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("Errors:");
    console.log("-".repeat(60));
    
    // Sort errors by count
    const errors = Object.entries(stats.errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 errors
    
    for (const [error, count] of errors) {
      console.log(`  ${count.toString().padStart(6)}x ${error}`);
    }
    
    if (Object.keys(stats.errors).length > 10) {
      console.log(`  ... and ${Object.keys(stats.errors).length - 10} more error types`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  
  // Save detailed report
  const report = {
    summary: {
      totalOperations: totalOps,
      totalErrors: totalErrors,
      successRate: ((totalOps / (totalOps + totalErrors)) * 100).toFixed(2) + '%',
    },
    operations: stats,
    generatedAt: new Date().toISOString(),
  };
  
  const reportPath = './data/load-test-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

function main() {
  try {
    console.log("Analyzing load test results...\n");
    
    const stats = aggregateStats();
    generateReport(stats);
    
  } catch (error) {
    console.error("Failed to analyze results:", error);
    process.exit(1);
  }
}

main();



