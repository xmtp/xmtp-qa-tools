import fs from "fs";
import path from "path";
import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

interface TestFailure {
  testName: string | null;
  environment: string | null;
  geolocation: string | null;
  timestamp: string | null;
  workflowUrl: string | null;
  dashboardUrl: string | null;
  customLinks: string | null;
  errorLogs: string[];
}

interface IssuesData {
  metadata: {
    source: string;
    date: string;
    totalTestFailures: number;
    totalLogEntries: number;
    queryPeriod: {
      from: string;
      to: string;
    };
  };
  testFailures: TestFailure[];
}

// Validate required environment variables
const requiredEnvVars = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"];
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

// Read test failures from issues.json
function readTestFailures(): { failures: TestFailure[]; lastUpdate: Date } {
  try {
    const issuesPath = path.join(__dirname, "issues.json");
    const issuesData = fs.readFileSync(issuesPath, "utf8");
    const parsedData: IssuesData = JSON.parse(issuesData);
    return {
      failures: parsedData.testFailures,
      lastUpdate: new Date(parsedData.metadata.date),
    };
  } catch (error) {
    logger.error(
      `Error reading issues.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { failures: [], lastUpdate: new Date() };
  }
}

// Format test failures for Slack display
function formatTestFailures(failures: TestFailure[], lastUpdate: Date): string {
  if (failures.length === 0) {
    return `📊 No test failures found (Last updated: ${lastUpdate.toLocaleTimeString()})`;
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

  let result = `📊 Found ${failures.length} test failures (Last updated: ${lastUpdate.toLocaleTimeString()}):\n\n`;

  for (const [testName, testFailures] of Object.entries(grouped)) {
    result += `**${testName}** (${testFailures.length} failures)\n`;

    for (const failure of testFailures.slice(0, 3)) {
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

// Handle messages about test failures
function handleMessage(message: string): string {
  const { failures, lastUpdate } = readTestFailures();
  const lowerMessage = message.toLowerCase();

  // Filter failures based on question
  if (lowerMessage.includes("browser")) {
    const browserFailures = failures.filter(
      (f) =>
        f.testName?.toLowerCase().includes("browser") ||
        f.testName?.toLowerCase().includes("playwright"),
    );
    return formatTestFailures(browserFailures, lastUpdate);
  }

  if (lowerMessage.includes("agent") || lowerMessage.includes("bot")) {
    const agentFailures = failures.filter(
      (f) =>
        f.testName?.toLowerCase().includes("agent") ||
        f.testName?.toLowerCase().includes("bot"),
    );
    return formatTestFailures(agentFailures, lastUpdate);
  }

  if (lowerMessage.includes("group")) {
    const groupFailures = failures.filter((f) =>
      f.testName?.toLowerCase().includes("group"),
    );
    return formatTestFailures(groupFailures, lastUpdate);
  }

  // Default: show all failures
  return formatTestFailures(failures, lastUpdate);
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say, client }) => {
  try {
    const message = event.text || "";
    const userId = event.user;
    const channel = event.channel;

    logger.info(`📨 RECEIVED MENTION - Channel: ${channel}, User: ${userId}`);

    const thinkingMessage = `<@${userId}> 🤔 Checking issues.json...`;
    const thinkingResponse = await say(thinkingMessage);

    const botResponse = handleMessage(message);
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
    const errorResponse = `<@${event.user}> Sorry, I encountered an error reading issues.json.`;
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

      const thinkingMessage = "🤔 Checking issues.json...";
      const thinkingResponse = await say(thinkingMessage);

      const botResponse = handleMessage(messageText);

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
    await say("Sorry, I encountered an error reading issues.json.");
  }
});

// Application startup
void (async () => {
  try {
    await app.start();
    logger.info("🚀 Slack bot started successfully");
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
