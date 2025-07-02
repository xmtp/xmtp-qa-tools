#!/usr/bin/env node

/**
 * Performance Analysis Tool for XMTP QA Historical Data
 *
 * Analyzes test failure patterns and performance metrics from issues.json
 * for Cursor agent consumption.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load historical test data
function loadIssuesData() {
  try {
    const issuesPath = path.join(__dirname, "issues.json");
    const data = fs.readFileSync(issuesPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading issues.json:", error);
    return [];
  }
}

// Analyze performance test failures
function analyzePerformanceTests(issues) {
  const performanceIssues = issues.filter(
    (issue) => issue.test === "performance",
  );

  const analysis = {
    totalIssues: performanceIssues.length,
    timeouts: 0,
    memoryIssues: 0,
    groupOperationErrors: 0,
    environments: { dev: 0, production: 0 },
    commonErrors: new Map(),
    agentResponseTimes: [],
  };

  performanceIssues.forEach((issue) => {
    // Count by environment
    if (issue.environment) {
      analysis.environments[issue.environment]++;
    }

    // Analyze error messages
    issue.message.forEach((msg) => {
      if (msg.includes("Collector timed out")) {
        analysis.timeouts++;
        // Extract timeout duration
        const timeMatch = msg.match(/(\d+)s\./);
        if (timeMatch) {
          analysis.agentResponseTimes.push(parseInt(timeMatch[1]));
        }
      }

      if (msg.includes("sqlcipher_mlock") || msg.includes("MEMORY")) {
        analysis.memoryIssues++;
      }

      if (msg.includes("group") && msg.includes("error")) {
        analysis.groupOperationErrors++;
      }

      // Track common error patterns
      if (msg.includes("FAIL")) {
        const error = msg.replace(/^.*FAIL\s+/, "").split(" > ")[0];
        analysis.commonErrors.set(
          error,
          (analysis.commonErrors.get(error) || 0) + 1,
        );
      }
    });
  });

  return analysis;
}

// Analyze agent performance
function analyzeAgentTests(issues) {
  const agentIssues = issues.filter((issue) => issue.test === "agents");

  const analysis = {
    totalIssues: agentIssues.length,
    timeoutsByAgent: new Map(),
    environments: { dev: 0, production: 0 },
    responseTimeouts: [],
  };

  agentIssues.forEach((issue) => {
    if (issue.environment) {
      analysis.environments[issue.environment]++;
    }

    issue.message.forEach((msg) => {
      if (msg.includes("Collector timed out")) {
        // Extract agent name and timeout
        const agentMatch = msg.match(/\[([^-]+)-/);
        const timeMatch = msg.match(/(\d+)s\./);

        if (agentMatch && timeMatch) {
          const agent = agentMatch[1];
          const timeout = parseInt(timeMatch[1]);

          if (!analysis.timeoutsByAgent.has(agent)) {
            analysis.timeoutsByAgent.set(agent, []);
          }
          analysis.timeoutsByAgent.get(agent).push(timeout);
          analysis.responseTimeouts.push(timeout);
        }
      }
    });
  });

  return analysis;
}

// Generate performance summary
function generateSummary() {
  const issues = loadIssuesData();

  if (issues.length === 0) {
    console.log("No historical data available");
    return;
  }

  console.log("# XMTP QA Performance Analysis\n");
  console.log(`**Data Range**: Latest ${issues.length} test failures\n`);

  // Performance test analysis
  const perfAnalysis = analyzePerformanceTests(issues);
  console.log("## Performance Tests\n");
  console.log(`- **Total Issues**: ${perfAnalysis.totalIssues}`);
  console.log(`- **Timeout Issues**: ${perfAnalysis.timeouts}`);
  console.log(`- **Memory Issues**: ${perfAnalysis.memoryIssues}`);
  console.log(
    `- **Group Operation Errors**: ${perfAnalysis.groupOperationErrors}`,
  );
  console.log(
    `- **Environment Breakdown**: Dev: ${perfAnalysis.environments.dev}, Production: ${perfAnalysis.environments.production}\n`,
  );

  if (perfAnalysis.agentResponseTimes.length > 0) {
    const avgResponseTime =
      perfAnalysis.agentResponseTimes.reduce((a, b) => a + b, 0) /
      perfAnalysis.agentResponseTimes.length;
    console.log(
      `- **Average Timeout Duration**: ${avgResponseTime.toFixed(1)}s`,
    );
    console.log(
      `- **Max Timeout**: ${Math.max(...perfAnalysis.agentResponseTimes)}s\n`,
    );
  }

  // Agent analysis
  const agentAnalysis = analyzeAgentTests(issues);
  console.log("## Agent Monitoring\n");
  console.log(`- **Total Agent Issues**: ${agentAnalysis.totalIssues}`);
  console.log(
    `- **Environment Breakdown**: Dev: ${agentAnalysis.environments.dev}, Production: ${agentAnalysis.environments.production}\n`,
  );

  if (agentAnalysis.timeoutsByAgent.size > 0) {
    console.log("### Agent Timeout Summary:");
    for (const [agent, timeouts] of agentAnalysis.timeoutsByAgent) {
      const avgTimeout = timeouts.reduce((a, b) => a + b, 0) / timeouts.length;
      console.log(
        `- **${agent}**: ${timeouts.length} timeouts, avg ${avgTimeout.toFixed(1)}s`,
      );
    }
    console.log("");
  }

  // Common error patterns
  if (perfAnalysis.commonErrors.size > 0) {
    console.log("## Most Common Test Failures:\n");
    const sortedErrors = Array.from(perfAnalysis.commonErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedErrors.forEach(([error, count]) => {
      console.log(`- **${error}**: ${count} occurrences`);
    });
    console.log("");
  }

  // Test type breakdown
  const testTypes = {};
  issues.forEach((issue) => {
    testTypes[issue.test] = (testTypes[issue.test] || 0) + 1;
  });

  console.log("## Test Type Breakdown:\n");
  Object.entries(testTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([test, count]) => {
      console.log(`- **${test}**: ${count} failures`);
    });
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSummary();
}

export { analyzePerformanceTests, analyzeAgentTests, loadIssuesData };
