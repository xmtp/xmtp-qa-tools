#!/usr/bin/env node

/**
 * Report Generator for XMTP QA Historical Data
 *
 * Generates markdown reports of test failures and performance metrics
 * for easy consumption by Cursor agents.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  analyzeAgentTests,
  analyzePerformanceTests,
  loadIssuesData,
} from "./analyze-performance.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate daily summary report
function generateDailySummary() {
  const issues = loadIssuesData();
  const now = new Date();
  const reportDate = now.toDateString();

  if (issues.length === 0) {
    return `# XMTP QA Daily Report - ${reportDate}\n\n**No test failure data available**\n`;
  }

  // Filter issues from last 24 hours (approximate)
  const recentIssues = issues.slice(0, Math.min(50, issues.length));

  const performanceAnalysis = analyzePerformanceTests(recentIssues);
  const agentAnalysis = analyzeAgentTests(recentIssues);

  // Count test types
  const testTypeCounts = {};
  recentIssues.forEach((issue) => {
    testTypeCounts[issue.test] = (testTypeCounts[issue.test] || 0) + 1;
  });

  // Environment breakdown
  const envCounts = { dev: 0, production: 0 };
  recentIssues.forEach((issue) => {
    if (issue.environment) {
      envCounts[issue.environment]++;
    }
  });

  let report = `# XMTP QA Daily Report - ${reportDate}\n\n`;

  // Executive Summary
  report += `## 📊 Executive Summary\n\n`;
  report += `- **Total Issues Analyzed**: ${recentIssues.length}\n`;
  report += `- **Performance Issues**: ${performanceAnalysis.totalIssues}\n`;
  report += `- **Agent Issues**: ${agentAnalysis.totalIssues}\n`;
  report += `- **Environment Split**: Dev: ${envCounts.dev}, Production: ${envCounts.production}\n\n`;

  // Critical Issues
  report += `## 🚨 Critical Issues\n\n`;

  if (performanceAnalysis.timeouts > 0) {
    report += `### Performance Timeouts\n`;
    report += `- **Count**: ${performanceAnalysis.timeouts} timeout issues\n`;
    if (performanceAnalysis.agentResponseTimes.length > 0) {
      const avgTimeout =
        performanceAnalysis.agentResponseTimes.reduce((a, b) => a + b, 0) /
        performanceAnalysis.agentResponseTimes.length;
      report += `- **Average Duration**: ${avgTimeout.toFixed(1)}s\n`;
      report += `- **Max Duration**: ${Math.max(...performanceAnalysis.agentResponseTimes)}s\n`;
    }
    report += `\n`;
  }

  if (performanceAnalysis.memoryIssues > 0) {
    report += `### Memory Issues\n`;
    report += `- **Count**: ${performanceAnalysis.memoryIssues} memory-related errors\n`;
    report += `- **Common Pattern**: sqlcipher_mlock errors\n\n`;
  }

  if (agentAnalysis.timeoutsByAgent.size > 0) {
    report += `### Agent Response Issues\n`;
    for (const [agent, timeouts] of agentAnalysis.timeoutsByAgent) {
      const avgTimeout = timeouts.reduce((a, b) => a + b, 0) / timeouts.length;
      report += `- **${agent}**: ${timeouts.length} timeouts (avg: ${avgTimeout.toFixed(1)}s)\n`;
    }
    report += `\n`;
  }

  // Test Suite Status
  report += `## 🧪 Test Suite Status\n\n`;
  Object.entries(testTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([test, count]) => {
      const status =
        count > 10 ? "🔴 High" : count > 5 ? "🟡 Medium" : "🟢 Low";
      report += `- **${test}**: ${count} issues ${status}\n`;
    });

  // Common Failure Patterns
  report += `\n## 🔍 Common Failure Patterns\n\n`;

  const failurePatterns = new Map();
  recentIssues.forEach((issue) => {
    issue.message.forEach((msg) => {
      if (msg.includes("FAIL")) {
        const pattern = msg.split(" > ").pop() || msg;
        failurePatterns.set(pattern, (failurePatterns.get(pattern) || 0) + 1);
      }
    });
  });

  Array.from(failurePatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([pattern, count]) => {
      report += `- **${pattern}** (${count}x)\n`;
    });

  // Recommendations
  report += `\n## 💡 Recommendations\n\n`;

  if (performanceAnalysis.timeouts > 5) {
    report += `- **Performance**: High timeout rate suggests capacity or network issues\n`;
  }

  if (performanceAnalysis.memoryIssues > 3) {
    report += `- **Memory**: Multiple memory errors indicate resource constraints\n`;
  }

  if (envCounts.production > envCounts.dev * 2) {
    report += `- **Environment**: Production showing disproportionate issues vs dev\n`;
  }

  if (agentAnalysis.timeoutsByAgent.size > 0) {
    report += `- **Agents**: Monitor agent response times, consider timeout adjustments\n`;
  }

  report += `\n---\n`;
  report += `*Report generated on ${now.toISOString()}*\n`;
  report += `*Data source: history/issues.json (${issues.length} total entries)*\n`;

  return report;
}

// Generate performance trends report
function generatePerformanceTrends() {
  const issues = loadIssuesData();

  if (issues.length === 0) {
    return `# Performance Trends - No Data Available\n`;
  }

  const performanceIssues = issues.filter(
    (issue) => issue.test === "performance",
  );
  const agentIssues = issues.filter((issue) => issue.test === "agents");

  let report = `# XMTP Performance Trends Analysis\n\n`;

  report += `## 📈 Performance Metrics Overview\n\n`;
  report += `- **Performance Test Issues**: ${performanceIssues.length}\n`;
  report += `- **Agent Test Issues**: ${agentIssues.length}\n`;
  report += `- **Total Data Points**: ${issues.length}\n\n`;

  // Timeout analysis
  const timeouts = [];
  issues.forEach((issue) => {
    issue.message.forEach((msg) => {
      const timeMatch = msg.match(/Collector timed out\. (\d+)s\./);
      if (timeMatch) {
        timeouts.push({
          duration: parseInt(timeMatch[1]),
          test: issue.test,
          environment: issue.environment,
        });
      }
    });
  });

  if (timeouts.length > 0) {
    report += `## ⏱️ Timeout Analysis\n\n`;
    report += `- **Total Timeouts**: ${timeouts.length}\n`;

    const avgTimeout =
      timeouts.reduce((sum, t) => sum + t.duration, 0) / timeouts.length;
    report += `- **Average Duration**: ${avgTimeout.toFixed(1)}s\n`;
    report += `- **Range**: ${Math.min(...timeouts.map((t) => t.duration))}s - ${Math.max(...timeouts.map((t) => t.duration))}s\n\n`;

    // Timeout by test type
    const timeoutsByTest = {};
    timeouts.forEach((t) => {
      timeoutsByTest[t.test] = (timeoutsByTest[t.test] || []).concat(
        t.duration,
      );
    });

    report += `### By Test Type:\n`;
    Object.entries(timeoutsByTest).forEach(([test, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      report += `- **${test}**: ${durations.length} timeouts, avg ${avg.toFixed(1)}s\n`;
    });
    report += `\n`;
  }

  // Error pattern frequency
  const errorPatterns = new Map();
  issues.forEach((issue) => {
    issue.message.forEach((msg) => {
      if (msg.includes("xmtp_mls::groups::")) {
        const pattern =
          msg.match(/xmtp_mls::groups::([^:]+)/)?.[1] || "unknown";
        errorPatterns.set(pattern, (errorPatterns.get(pattern) || 0) + 1);
      }
    });
  });

  if (errorPatterns.size > 0) {
    report += `## 🔍 Error Pattern Frequency\n\n`;
    Array.from(errorPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([pattern, count]) => {
        report += `- **${pattern}**: ${count} occurrences\n`;
      });
    report += `\n`;
  }

  return report;
}

// Save report to file
function saveReport(content, filename) {
  const reportPath = path.join(__dirname, filename);
  fs.writeFileSync(reportPath, content, "utf8");
  console.log(`📄 Report saved to ${reportPath}`);
  return reportPath;
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const reportType =
    args.find((arg) => ["--daily", "--trends", "--week"].includes(arg)) ||
    "--daily";

  console.log("📊 Generating XMTP QA Report...\n");

  let content;
  let filename;

  switch (reportType) {
    case "--daily":
      content = generateDailySummary();
      filename = "daily-report.md";
      break;
    case "--trends":
      content = generatePerformanceTrends();
      filename = "performance-trends.md";
      break;
    case "--week":
      content = generateDailySummary(); // For now, same as daily
      filename = "weekly-report.md";
      break;
    default:
      content = generateDailySummary();
      filename = "daily-report.md";
  }

  const reportPath = saveReport(content, filename);

  console.log("\n✅ Report generation complete!");
  console.log(`📄 View report: cat ${reportPath}`);
  console.log(`🔍 Quick view: head -20 ${reportPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateDailySummary, generatePerformanceTrends, saveReport };
