import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";
import fetch from "node-fetch";
import type { DatadogLogEntry } from "./history.test";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

interface DatadogLogsResponse {
  data: DatadogLogEntry[];
  meta: {
    page: {
      after?: string;
    };
  };
}

interface TestFailure {
  testName: string | null;
  environment: string | null;
  geolocation: string | null;
  timestamp: string | null;
  errorLogs: string[];
}

// Validate required environment variables
const requiredEnvVars = [
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "DATADOG_API_KEY",
  "DATADOG_APP_KEY",
];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  logger.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  process.exit(1);
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN as string,
  appToken: process.env.SLACK_APP_TOKEN as string,
  socketMode: true,
  logLevel: LogLevel.ERROR,
});

// Store latest test failures globally
let latestTestFailures: TestFailure[] = [];
let lastFetchTime: Date = new Date();

// Analysis functions
interface ComponentStatus {
  name: string;
  status: "healthy" | "issues" | "down";
  failureCount: number;
  recentFailures: TestFailure[];
  summary: string;
}

interface SystemAnalysis {
  overallHealth: "healthy" | "issues" | "critical";
  componentStatuses: ComponentStatus[];
  totalFailures: number;
  criticalIssues: string[];
  recommendations: string[];
}

function analyzeTestFailures(
  failures: TestFailure[],
  hours: number = 24,
): SystemAnalysis {
  const componentMap = new Map<string, TestFailure[]>();

  // Group failures by component/category
  failures.forEach((failure) => {
    const testName = failure.testName || "unknown";
    const component = extractComponent(testName);

    if (!componentMap.has(component)) {
      componentMap.set(component, []);
    }
    const componentFailures = componentMap.get(component);
    if (componentFailures) {
      componentFailures.push(failure);
    }
  });

  const componentStatuses: ComponentStatus[] = [];
  const criticalIssues: string[] = [];

  // Analyze each component
  for (const [component, componentFailures] of componentMap) {
    const failureCount = componentFailures.length;
    let status: "healthy" | "issues" | "down";
    let summary: string;

    if (failureCount === 0) {
      status = "healthy";
      summary = "No issues detected";
    } else if (failureCount <= 2) {
      status = "issues";
      summary = `${failureCount} minor issue${failureCount > 1 ? "s" : ""}`;
    } else {
      status = "down";
      summary = `${failureCount} failures - needs attention`;
      criticalIssues.push(`${component}: ${failureCount} failures`);
    }

    componentStatuses.push({
      name: component,
      status,
      failureCount,
      recentFailures: componentFailures.slice(0, 3),
      summary,
    });
  }

  // Determine overall health
  const criticalComponents = componentStatuses.filter(
    (c) => c.status === "down",
  ).length;
  const issueComponents = componentStatuses.filter(
    (c) => c.status === "issues",
  ).length;

  let overallHealth: "healthy" | "issues" | "critical";
  if (criticalComponents > 0) {
    overallHealth = "critical";
  } else if (issueComponents > 2) {
    overallHealth = "issues";
  } else {
    overallHealth = "healthy";
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalComponents > 0) {
    recommendations.push(
      "🚨 Immediate attention required for critical components",
    );
  }
  if (
    failures.some((f) => f.errorLogs.some((log) => log.includes("timeout")))
  ) {
    recommendations.push(
      "⏱️ Multiple timeout issues detected - check network/performance",
    );
  }
  if (
    failures.some((f) => f.errorLogs.some((log) => log.includes("connection")))
  ) {
    recommendations.push(
      "🔌 Connection issues detected - check service availability",
    );
  }

  return {
    overallHealth,
    componentStatuses,
    totalFailures: failures.length,
    criticalIssues,
    recommendations,
  };
}

function extractComponent(testName: string): string {
  const name = testName.toLowerCase();

  if (name.includes("browser") || name.includes("playwright")) return "browser";
  if (name.includes("agent") || name.includes("bot")) return "agents";
  if (name.includes("group")) return "groups";
  if (name.includes("dm") || name.includes("direct")) return "direct-messages";
  if (name.includes("stream")) return "streams";
  if (name.includes("sync")) return "sync";
  if (name.includes("consent")) return "consent";
  if (name.includes("notification")) return "notifications";
  if (name.includes("mobile")) return "mobile";
  if (name.includes("performance") || name.includes("bench"))
    return "performance";
  if (name.includes("stress") || name.includes("large")) return "load-testing";
  if (name.includes("regression")) return "regression";
  if (name.includes("smoke")) return "smoke-tests";

  return "general";
}

function answerSpecificQuestion(
  question: string,
  analysis: SystemAnalysis,
): string {
  const lowerQuestion = question.toLowerCase();

  // Browser status questions
  if (lowerQuestion.includes("browser")) {
    const browserStatus = analysis.componentStatuses.find(
      (c) => c.name === "browser",
    );
    if (!browserStatus) {
      return "🌐 **Browser Tests**: No recent browser test data available";
    }

    const statusEmoji =
      browserStatus.status === "healthy"
        ? "✅"
        : browserStatus.status === "issues"
          ? "⚠️"
          : "❌";

    return `🌐 **Browser Tests**: ${statusEmoji} ${browserStatus.summary}\n${browserStatus.failureCount > 0 ? `Recent issues: ${browserStatus.recentFailures.map((f) => f.errorLogs[0]?.substring(0, 100)).join(", ")}` : "All browser tests passing"}`;
  }

  // Agent status questions
  if (lowerQuestion.includes("agent") || lowerQuestion.includes("bot")) {
    const agentStatus = analysis.componentStatuses.find(
      (c) => c.name === "agents",
    );
    if (!agentStatus) {
      return "🤖 **Agents**: No recent agent test data available";
    }

    const statusEmoji =
      agentStatus.status === "healthy"
        ? "✅"
        : agentStatus.status === "issues"
          ? "⚠️"
          : "❌";

    return `🤖 **Agents**: ${statusEmoji} ${agentStatus.summary}\n${agentStatus.failureCount > 0 ? `Issues detected: ${agentStatus.recentFailures.map((f) => f.testName).join(", ")}` : "All agents functioning normally"}`;
  }

  // Groups status
  if (lowerQuestion.includes("group")) {
    const groupStatus = analysis.componentStatuses.find(
      (c) => c.name === "groups",
    );
    if (!groupStatus) {
      return "👥 **Groups**: No recent group test data available";
    }

    const statusEmoji =
      groupStatus.status === "healthy"
        ? "✅"
        : groupStatus.status === "issues"
          ? "⚠️"
          : "❌";

    return `👥 **Groups**: ${statusEmoji} ${groupStatus.summary}`;
  }

  // Performance questions
  if (
    lowerQuestion.includes("performance") ||
    lowerQuestion.includes("slow") ||
    lowerQuestion.includes("speed")
  ) {
    const perfStatus = analysis.componentStatuses.find(
      (c) => c.name === "performance",
    );
    const timeoutIssues = analysis.componentStatuses.flatMap((c) =>
      c.recentFailures.filter((f) =>
        f.errorLogs.some((log) => log.includes("timeout")),
      ),
    );

    return `⚡ **Performance**: ${perfStatus ? perfStatus.summary : "No performance test data"}\n${timeoutIssues.length > 0 ? `⏱️ ${timeoutIssues.length} timeout issues detected` : "No timeout issues"}`;
  }

  // Overall health questions
  if (
    lowerQuestion.includes("health") ||
    lowerQuestion.includes("status") ||
    lowerQuestion.includes("everything") ||
    lowerQuestion.includes("overall")
  ) {
    const healthEmoji =
      analysis.overallHealth === "healthy"
        ? "✅"
        : analysis.overallHealth === "issues"
          ? "⚠️"
          : "❌";

    let response = `${healthEmoji} **Overall System Health**: ${analysis.overallHealth.toUpperCase()}\n\n`;

    response += `📊 **Summary**: ${analysis.totalFailures} total failures in last 24h\n\n`;

    if (analysis.criticalIssues.length > 0) {
      response += `🚨 **Critical Issues**:\n${analysis.criticalIssues.map((issue) => `• ${issue}`).join("\n")}\n\n`;
    }

    response += `🔍 **Component Status**:\n`;
    analysis.componentStatuses.forEach((comp) => {
      const emoji =
        comp.status === "healthy"
          ? "✅"
          : comp.status === "issues"
            ? "⚠️"
            : "❌";
      response += `${emoji} ${comp.name}: ${comp.summary}\n`;
    });

    if (analysis.recommendations.length > 0) {
      response += `\n💡 **Recommendations**:\n${analysis.recommendations.map((rec) => `• ${rec}`).join("\n")}`;
    }

    return response;
  }

  // What's down/failing questions
  if (
    lowerQuestion.includes("down") ||
    lowerQuestion.includes("failing") ||
    lowerQuestion.includes("broken")
  ) {
    const criticalComponents = analysis.componentStatuses.filter(
      (c) => c.status === "down",
    );
    const issueComponents = analysis.componentStatuses.filter(
      (c) => c.status === "issues",
    );

    if (criticalComponents.length === 0 && issueComponents.length === 0) {
      return "✅ **Good news!** No components are currently down or experiencing major issues.";
    }

    let response = "";
    if (criticalComponents.length > 0) {
      response += `❌ **Down/Critical**:\n${criticalComponents.map((c) => `• ${c.name}: ${c.failureCount} failures`).join("\n")}\n\n`;
    }

    if (issueComponents.length > 0) {
      response += `⚠️ **Minor Issues**:\n${issueComponents.map((c) => `• ${c.name}: ${c.failureCount} issue${c.failureCount > 1 ? "s" : ""}`).join("\n")}`;
    }

    return response;
  }

  // Default response if no specific question matched
  const analysis_summary = `📊 **Latest Data** (${lastFetchTime.toLocaleTimeString()}):\n${analysis.totalFailures} total failures detected\n\nTry asking: "is browser fine?", "what agents are down?", "overall health", "what's broken?"`;
  return analysis_summary;
}

// Fetch test failures from Datadog
async function fetchDatadogTestFailures(
  hours: number = 24,
): Promise<TestFailure[]> {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error(
      "Missing DATADOG_API_KEY or DATADOG_APP_KEY environment variables",
    );
  }

  const now = new Date();
  const hoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const fromTime = hoursAgo.toISOString();
  const toTime = now.toISOString();

  // Query Datadog Logs API
  const allLogs: DatadogLogEntry[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await fetch(
      "https://api.datadoghq.com/api/v2/logs/events/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": process.env.DATADOG_API_KEY,
          "DD-APPLICATION-KEY": process.env.DATADOG_APP_KEY,
        },
        body: JSON.stringify({
          filter: {
            query: "service:xmtp-qa-tools",
            from: fromTime,
            to: toTime,
          },
          sort: "-timestamp",
          page: {
            limit: 1000,
            cursor: nextCursor,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Datadog API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as DatadogLogsResponse;
    allLogs.push(...data.data);
    nextCursor = data.meta?.page?.after;
  } while (nextCursor);

  // Process logs and extract test failures
  const testFailures: TestFailure[] = allLogs
    .filter((log) => {
      const message = log.attributes.message || "";
      const hasTestContext = log.attributes.attributes.test;
      const isErrorLevel = log.attributes.attributes.level === "error";
      return (
        hasTestContext &&
        isErrorLevel &&
        (message.includes("failed") ||
          message.includes("error") ||
          message.includes("Error") ||
          message.includes("FAIL"))
      );
    })
    .map((log) => {
      const message = log.attributes.message || "";
      const attrs = log.attributes.attributes;

      return {
        testName: attrs.test || null,
        environment: attrs.env || null,
        geolocation: attrs.region || null,
        timestamp: log.attributes.timestamp || null,
        errorLogs: message.split("\n").filter((line) => line.trim()),
      };
    });

  // Remove duplicates based on test name and timestamp
  const uniqueFailures = testFailures.filter((failure, index, array) => {
    return (
      array.findIndex(
        (f) =>
          f.testName === failure.testName && f.timestamp === failure.timestamp,
      ) === index
    );
  });

  return uniqueFailures;
}

// Format test failures for Slack display
function formatTestFailuresForSlack(
  failures: TestFailure[],
  hours: number,
): string {
  if (failures.length === 0) {
    return `📊 No test failures found in the last ${hours} hours (Last updated: ${lastFetchTime.toLocaleTimeString()})`;
  }

  const grouped = failures.reduce<Record<string, TestFailure[]>>(
    (acc, failure) => {
      const key = failure.testName || "Unknown";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(failure);
      return acc;
    },
    {},
  );

  let result = `📊 Found ${failures.length} test failures in the last ${hours} hours (Last updated: ${lastFetchTime.toLocaleTimeString()}):\n\n`;

  for (const [testName, testFailures] of Object.entries(grouped)) {
    result += `**${testName}** (${testFailures.length} failures)\n`;

    for (const failure of testFailures.slice(0, 3)) {
      // Show max 3 per test
      const env = failure.environment || "unknown";
      const region = failure.geolocation || "unknown";
      const time = failure.timestamp
        ? new Date(failure.timestamp).toLocaleTimeString()
        : "unknown";

      result += `• ${env}/${region} at ${time}\n`;
      if (failure.errorLogs[0]) {
        result += `  \`${failure.errorLogs[0].substring(0, 100)}${failure.errorLogs[0].length > 100 ? "..." : ""}\`\n`;
      }
    }

    if (testFailures.length > 3) {
      result += `  ... and ${testFailures.length - 3} more\n`;
    }
    result += "\n";
  }

  return result;
}

// Periodic fetch function
async function fetchLogsAndUpdate(): Promise<void> {
  try {
    logger.info("🔍 Fetching DataDog logs...");
    latestTestFailures = await fetchDatadogTestFailures(24);
    lastFetchTime = new Date();
    logger.info(`📋 Fetched ${latestTestFailures.length} test failures`);
  } catch (error) {
    logger.error(
      `❌ Error fetching DataDog logs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Handle messages with DataDog log information
async function handleMessage(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // Check for specific time requests
  let hours = 24;
  const hourMatch = message.match(/(\d+)\s*hours?/i);
  if (hourMatch) {
    hours = parseInt(hourMatch[1]);
  }

  // Determine which data to use for analysis
  let dataToAnalyze: TestFailure[];

  // Check if user wants fresh data
  if (
    lowerMessage.includes("fresh") ||
    lowerMessage.includes("latest") ||
    lowerMessage.includes("now")
  ) {
    try {
      logger.info("🔄 Fetching fresh DataDog logs on demand...");
      dataToAnalyze = await fetchDatadogTestFailures(hours);
    } catch (error) {
      return `❌ Error fetching fresh DataDog logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else if (hours !== 24) {
    // If specific hours requested, fetch fresh data
    try {
      dataToAnalyze = await fetchDatadogTestFailures(hours);
    } catch (error) {
      return `❌ Error fetching DataDog logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    // Use cached data
    dataToAnalyze = latestTestFailures;
  }

  // Analyze the data
  const analysis = analyzeTestFailures(dataToAnalyze, hours);

  // Check if user wants raw data instead of analysis
  if (
    lowerMessage.includes("raw") ||
    lowerMessage.includes("list") ||
    lowerMessage.includes("show all")
  ) {
    return formatTestFailuresForSlack(dataToAnalyze, hours);
  }

  // Answer specific questions about the analysis
  return answerSpecificQuestion(message, analysis);
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say, client }) => {
  try {
    const message = event.text || "";
    const userId = event.user;
    const channel = event.channel;

    logger.info(`📨 RECEIVED MENTION - Channel: ${channel}, User: ${userId}`);

    const thinkingMessage = `<@${userId}> 🤔 Checking DataDog logs...`;
    const thinkingResponse = await say(thinkingMessage);

    const botResponse = await handleMessage(message);
    const finalResponse = `<@${userId}> ${botResponse}`;

    // Replace the thinking message with the final response
    if (thinkingResponse && thinkingResponse.ts) {
      await client.chat.update({
        channel: channel,
        ts: thinkingResponse.ts,
        text: finalResponse,
      });
    } else {
      await say(finalResponse);
    }
  } catch (error: unknown) {
    logger.error(
      `Error processing app mention: ${error instanceof Error ? error.message : String(error)}`,
    );
    const errorResponse = `<@${event.user}> Sorry, I encountered an error checking DataDog logs.`;
    await say(errorResponse);
  }
});

// Respond to direct messages
app.message(async ({ message, say, client }) => {
  // Type guard to ensure we have the right message type
  if (
    !("text" in message) ||
    !("user" in message) ||
    !message.text ||
    message.subtype === "bot_message"
  ) {
    return;
  }

  try {
    // Check if it's a DM
    const channelInfo = await client.conversations.info({
      channel: message.channel,
    });

    if (channelInfo.channel?.is_im) {
      const messageText = message.text;
      const userId = message.user;

      logger.info(`📨 RECEIVED DM - User: ${userId}`);

      const thinkingMessage = "🤔 Checking DataDog logs...";
      const thinkingResponse = await say(thinkingMessage);

      const botResponse = await handleMessage(messageText);

      // Replace the thinking message with the final response
      if (thinkingResponse && thinkingResponse.ts) {
        await client.chat.update({
          channel: message.channel,
          ts: thinkingResponse.ts,
          text: botResponse,
        });
      } else {
        await say(botResponse);
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Error processing direct message: ${error instanceof Error ? error.message : String(error)}`,
    );
    await say("Sorry, I encountered an error checking DataDog logs.");
  }
});

// Application startup
void (async () => {
  try {
    // Start Slack bot
    await app.start();
    logger.info("🚀 Slack bot started successfully");

    // Initial fetch
    await fetchLogsAndUpdate();

    // Set up periodic fetching every 10 minutes
    setInterval(() => void fetchLogsAndUpdate(), 10 * 60 * 1000);
    logger.info("⏰ DataDog log fetching scheduled every 10 minutes");
  } catch (error: unknown) {
    logger.error(
      `Failed to start application: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("🛑 Shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🛑 Shutting down gracefully");
  process.exit(0);
});
