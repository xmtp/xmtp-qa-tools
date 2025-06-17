import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";
import {
  askClaude,
  formatSlackResponse,
  processDatadogLogs,
  readIssuesData,
} from "./helper";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

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

// Auto-refresh issues.json from Datadog every 10 minutes
let refreshInterval: NodeJS.Timeout | null = null;

async function refreshIssuesData(): Promise<void> {
  try {
    logger.info("🔄 Refreshing issues data from Datadog...");
    await processDatadogLogs();
    logger.info("✅ Issues data refreshed successfully");
  } catch (error) {
    logger.error(
      `❌ Failed to refresh issues data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function startAutoRefresh(): void {
  // Initial refresh
  void refreshIssuesData();

  // Set up 10-minute interval (600,000 ms)
  refreshInterval = setInterval(
    () => {
      void refreshIssuesData();
    },
    10 * 60 * 1000,
  );
  logger.info(
    "🔄 Auto-refresh started: issues.json will update every 10 minutes",
  );
}

function stopAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    logger.info("🛑 Auto-refresh stopped");
  }
}

// Handle messages using Claude analyzer
async function handleMessage(message: string): Promise<string> {
  const rawData = readIssuesData();

  if (!rawData) {
    return "❌ Could not read issues.json file";
  }

  try {
    const response = await askClaude(message, rawData);
    return formatSlackResponse(response);
  } catch (error) {
    logger.error(
      `Error getting Claude response: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "❌ Error analyzing issues data";
  }
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say, client }) => {
  try {
    const message = event.text || "";
    const userId = event.user;
    const channel = event.channel;

    logger.info(`📨 RECEIVED MENTION - Channel: ${channel}, User: ${userId}`);

    const thinkingMessage = `<@${userId}> 🤔 *Thinking...*`;
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
    const errorResponse = `<@${event.user}> 🚨 *Error:* Sorry, I encountered an error analyzing the data.`;
    await say(errorResponse);
  }
});

// Handle /qa slash command
app.command("/qa", async ({ command, ack, say, client }) => {
  try {
    // Acknowledge the command request
    await ack();

    const messageText = command.text || "What are the current issues?";
    const userId = command.user_id;
    const channel = command.channel_id;

    logger.info(
      `🔸 RECEIVED SLASH COMMAND - Channel: ${channel}, User: ${userId}`,
    );

    const thinkingMessage = `<@${userId}> 🤔 *Thinking...*`;
    const thinkingResponse = await say(thinkingMessage);

    const botResponse = await handleMessage(messageText);
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
      `Error processing slash command: ${error instanceof Error ? error.message : String(error)}`,
    );
    const errorResponse = `<@${command.user_id}> 🚨 *Error:* Sorry, I encountered an error analyzing the data.`;
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

      const thinkingMessage = "🤔 *Thinking...*";
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
    await say("🚨 *Error:* Sorry, I encountered an error analyzing the data.");
  }
});

// Application startup
void (async () => {
  try {
    await app.start();
    logger.info("🚀 Slack bot started successfully");

    // Start auto-refresh for issues data
    startAutoRefresh();
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
  stopAutoRefresh();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🛑 Shutting down gracefully");
  stopAutoRefresh();
  process.exit(0);
});
