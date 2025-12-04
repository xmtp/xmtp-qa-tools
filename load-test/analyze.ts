#!/usr/bin/env tsx
/**
 * Analyze load test results
 * 
 * Reads Artillery report and provides detailed analysis
 */

import { readFileSync, existsSync } from "fs";

interface ArtilleryReport {
  aggregate: {
    counters: Record<string, number>;
    rates: Record<string, number>;
    histograms: Record<string, {
      min: number;
      max: number;
      median: number;
      p95: number;
      p99: number;
    }>;
  };
  intermediate: Array<{
    timestamp: string;
    counters: Record<string, number>;
  }>;
}

function analyzeReport(reportPath: string) {
  if (!existsSync(reportPath)) {
    console.error(`❌ Report not found: ${reportPath}`);
    console.log("Run: npm run test:debug");
    process.exit(1);
  }

  console.log("📊 XMTP Load Test Analysis");
  console.log("=".repeat(60));

  const report: ArtilleryReport = JSON.parse(readFileSync(reportPath, "utf-8"));
  const { aggregate } = report;

  // Messages
  const messagesSent = aggregate.counters["messages.sent"] || 0;
  const messagesFailed = aggregate.counters["messages.failed"] || 0;
  const totalMessages = messagesSent + messagesFailed;
  const successRate = totalMessages > 0 ? (messagesSent / totalMessages) * 100 : 0;

  console.log("\n📨 Message Statistics:");
  console.log(`  Total sent: ${messagesSent.toLocaleString()}`);
  console.log(`  Failed: ${messagesFailed.toLocaleString()}`);
  console.log(`  Success rate: ${successRate.toFixed(2)}%`);

  // Throughput
  const rps = aggregate.rates["messages.sent"] || 0;
  console.log(`\n⚡ Throughput:`);
  console.log(`  Messages/second: ${rps.toFixed(2)}`);
  console.log(`  Messages/minute: ${(rps * 60).toFixed(0)}`);
  console.log(`  Messages/hour: ${(rps * 3600).toLocaleString()}`);
  console.log(`  Messages/day (projected): ${(rps * 86400).toLocaleString()}`);

  // Latency
  if (aggregate.histograms["message.send.duration"]) {
    const latency = aggregate.histograms["message.send.duration"];
    console.log(`\n⏱️  Latency (ms):`);
    console.log(`  Min: ${latency.min}`);
    console.log(`  Median: ${latency.median}`);
    console.log(`  p95: ${latency.p95}`);
    console.log(`  p99: ${latency.p99}`);
    console.log(`  Max: ${latency.max}`);
  }

  // Time-series analysis
  if (report.intermediate && report.intermediate.length > 0) {
    console.log(`\n📈 Time-Series Analysis:`);
    
    const rates: number[] = [];
    for (let i = 1; i < report.intermediate.length; i++) {
      const curr = report.intermediate[i].counters["messages.sent"] || 0;
      const prev = report.intermediate[i - 1].counters["messages.sent"] || 0;
      const rate = curr - prev;
      rates.push(rate);
    }

    if (rates.length > 0) {
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      
      console.log(`  Average rate: ${avgRate.toFixed(2)} msg/s`);
      console.log(`  Peak rate: ${maxRate} msg/s`);
      console.log(`  Min rate: ${minRate} msg/s`);
      console.log(`  Rate stability: ${((1 - (maxRate - minRate) / avgRate) * 100).toFixed(1)}%`);
    }
  }

  // Duration
  if (report.intermediate && report.intermediate.length >= 2) {
    const start = new Date(report.intermediate[0].timestamp);
    const end = new Date(report.intermediate[report.intermediate.length - 1].timestamp);
    const durationMs = end.getTime() - start.getTime();
    const durationSec = durationMs / 1000;
    const durationMin = durationSec / 60;
    const durationHrs = durationMin / 60;

    console.log(`\n⏰ Test Duration:`);
    if (durationHrs >= 1) {
      console.log(`  ${durationHrs.toFixed(2)} hours`);
    } else if (durationMin >= 1) {
      console.log(`  ${durationMin.toFixed(2)} minutes`);
    } else {
      console.log(`  ${durationSec.toFixed(1)} seconds`);
    }
  }

  // System recommendations
  console.log(`\n💡 Recommendations:`);
  
  if (successRate < 95) {
    console.log(`  ⚠️  Success rate is low (${successRate.toFixed(1)}%). Consider:`);
    console.log(`     - Reducing arrival rate`);
    console.log(`     - Increasing worker pool size`);
    console.log(`     - Checking XMTP node health`);
  } else {
    console.log(`  ✅ Success rate is good (${successRate.toFixed(1)}%)`);
  }

  if (aggregate.histograms["message.send.duration"]) {
    const p95 = aggregate.histograms["message.send.duration"].p95;
    if (p95 > 1000) {
      console.log(`  ⚠️  High p95 latency (${p95}ms). Consider:`);
      console.log(`     - Reducing concurrency`);
      console.log(`     - Using more powerful instance`);
      console.log(`     - Checking network latency`);
    } else if (p95 < 200) {
      console.log(`  ✅ Excellent latency (p95: ${p95}ms)`);
      console.log(`     - You may be able to increase load`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// Run analysis
const reportPath = process.argv[2] || "./report.json";
analyzeReport(reportPath);


