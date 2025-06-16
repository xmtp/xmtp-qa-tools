import fs from "fs";
import path from "path";
import { Anthropic } from "@anthropic-ai/sdk";
import { sendDatadogLog } from "@helpers/datadog";
import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;

interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  error?: string;
}

interface SlackChannelHistory {
  messages: any[];
  hasMore: boolean;
  responseMetadata?: any;
}

// Validate required environment variables
const requiredEnvVars = [
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "ANTHROPIC_API_KEY",
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

// Initialize Anthropic client
function initializeAnthropic(): void {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    logger.info("✅ Anthropic client initialized");
  }
}

// Input validation and sanitization
function validateAndSanitizeInput(input: string): ValidationResult {
  if (!input || typeof input !== "string") {
    return { isValid: false, error: "Invalid input" };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Empty message" };
  }

  if (trimmed.length > 4000) {
    return { isValid: false, error: "Message too long (max 4000 characters)" };
  }

  // Remove or escape potentially dangerous characters for safety
  const sanitized = trimmed.replace(/[`$\\]/g, "\\$&");

  return { isValid: true, sanitized };
}

// Parse commands from message
function parseCommand(
  message: string,
): { command: string; args: string[] } | null {
  const trimmed = message.trim();

  // Check for slash commands
  if (trimmed.startsWith("/")) {
    const parts = trimmed.slice(1).split(/\s+/);
    return {
      command: parts[0].toLowerCase(),
      args: parts.slice(1),
    };
  }

  return null;
}

// Fetch Slack channel history
async function fetchChannelHistory(
  client: any,
  channelId: string,
  limit: number = 50,
  query?: string,
): Promise<SlackChannelHistory> {
  try {
    logger.info(
      `📜 Fetching channel history for ${channelId}, limit: ${limit}`,
    );

    const result = await client.conversations.history({
      channel: channelId,
      limit: Math.min(limit, 100), // Slack API limit
      inclusive: true,
    });

    if (!result.ok) {
      throw new Error(`Slack API error: ${String(result.error)}`);
    }

    let messages = result.messages || [];

    // Filter messages if query is provided
    if (query) {
      const searchTerm = query.toLowerCase();
      messages = messages.filter(
        (msg: any) =>
          msg.text &&
          typeof msg.text === "string" &&
          msg.text.toLowerCase().includes(searchTerm),
      );
    }

    return {
      messages,
      hasMore: Boolean(result.has_more),
      responseMetadata: result.response_metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Error fetching channel history: ${errorMessage}`);
    throw error;
  }
}

// Format messages for display
function formatMessagesForDisplay(
  messages: any[],
  maxMessages: number = 10,
): string {
  if (messages.length === 0) {
    return "No messages found matching your criteria.";
  }

  const sortedMessages = messages
    .slice(0, maxMessages)
    .sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));

  let formatted = `📋 Found ${messages.length} message(s):\n\n`;

  for (const msg of sortedMessages) {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const user = msg.user ? `<@${msg.user}>` : "Unknown User";
    const text = msg.text ? msg.text.substring(0, 200) : "[No text]";

    formatted += `🕒 ${timestamp}\n`;
    formatted += `👤 ${user}\n`;
    formatted += `💬 ${text}\n`;
    if (text.length === 200 && msg.text && msg.text.length > 200) {
      formatted += `... (truncated)\n`;
    }
    formatted += `\n`;
  }

  if (messages.length > maxMessages) {
    formatted += `\n... and ${messages.length - maxMessages} more messages`;
  }

  return formatted;
}

// Handle DataDog logs command
async function handleDataDogLogsCommand(args: string[]): Promise<string> {
  try {
    const testName = args[0] || "recent-logs";
    const logMessage = `Fetching DataDog logs for: ${testName}`;

    // Send log to DataDog
    await sendDatadogLog(logMessage, {
      testName,
      source: "slack-bot",
      command: "logs",
      timestamp: new Date().toISOString(),
    });

    return `📊 DataDog log sent for test: ${testName}\nLog message: "${logMessage}"`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Error handling DataDog logs: ${errorMessage}`);
    return `❌ Error sending DataDog log: ${errorMessage}`;
  }
}

// Main command handler
async function handleCommand(
  command: string,
  args: string[],
  client: any,
  channelId: string,
): Promise<string> {
  switch (command) {
    case "history": {
      const limit = parseInt(args[0]) || 50;
      const query = args.slice(1).join(" ");

      try {
        const history = await fetchChannelHistory(
          client,
          channelId,
          limit,
          query,
        );
        return formatMessagesForDisplay(history.messages);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `❌ Error fetching channel history: ${errorMessage}`;
      }
    }

    case "logs":
      return await handleDataDogLogsCommand(args);

    case "help":
      return `🤖 Available commands:
• \`/history [limit] [search_query]\` - Fetch channel message history
• \`/logs [test_name]\` - Send DataDog log entry
• \`/help\` - Show this help message

Examples:
• \`/history 20\` - Get last 20 messages
• \`/history 10 xmtp\` - Get last 10 messages containing "xmtp"
• \`/logs integration-test\` - Send DataDog log for integration-test`;

    default:
      return `❓ Unknown command: ${command}. Type \`/help\` for available commands.`;
  }
}

// Load system prompt from context.md file
function loadSystemPrompt(): string {
  try {
    const contextPath = path.join(process.cwd(), ".claude", "context.md");
    const contextContent = fs.readFileSync(contextPath, "utf-8");

    return `You are an expert assistant for the XMTP QA Tools repository. You specialize in helping with XMTP (Extensible Message Transport Protocol) testing, debugging, and development.

Here is the comprehensive context about this repository:

${contextContent}

## Your Role:
- Provide expert guidance on XMTP testing and development
- Help debug issues using the patterns and knowledge from the context above
- Give specific, actionable advice based on the repository structure and best practices
- Prioritize checking logs, analyzing test patterns, and understanding configurations when helping users

## Response Formatting:
- **Keep responses very concise and to the point**
- Use **bold** for emphasis (will be converted to Slack format)
- Use \`code\` for inline code snippets
- Use \`\`\`code blocks\`\`\` for multi-line code
- Use bullet points with - for lists
- Avoid lengthy explanations - provide direct, actionable answers`;
  } catch (error) {
    logger.error(
      `Failed to load context.md: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Fallback to basic system prompt if file reading fails
    return `You are an expert assistant for the XMTP QA Tools repository. You specialize in helping with XMTP (Extensible Message Transport Protocol) testing, debugging, and development.

## Response Formatting:
- Use **bold** for emphasis (will be converted to Slack format)
- Use \`code\` for inline code snippets
- Use \`\`\`code blocks\`\`\` for multi-line code
- Keep responses clear and well-structured for Slack messaging`;
  }
}

// Convert standard markdown to Slack mrkdwn format
function convertToSlackFormat(message: string): string {
  let converted = message;

  // Convert **bold** to *bold*
  converted = converted.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Convert __bold__ to *bold*
  converted = converted.replace(/__(.*?)__/g, "*$1*");

  // Convert *italic* to _italic_ (but only single asterisks, not the double ones we just converted)
  converted = converted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "_$1_");

  // Convert `code` to `code` (already correct)
  // Keep ```code blocks``` as is (already correct)

  // Convert markdown links [text](url) to Slack format <url|text>
  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert > blockquotes to Slack format
  converted = converted.replace(/^> (.+)/gm, "> $1");

  // Convert numbered lists (1. item) to just bullet points with numbers
  converted = converted.replace(/^\d+\.\s+(.+)/gm, "• $1");

  // Convert - bullet points to •
  converted = converted.replace(/^-\s+(.+)/gm, "• $1");

  return converted;
}

// Process message with Anthropic SDK
async function processWithAnthropic(message: string): Promise<string> {
  if (!anthropicClient) {
    throw new Error("Anthropic client not initialized");
  }

  try {
    logger.info(
      `🤖 Sending message to Anthropic: "${message.substring(0, 50)}..."`,
    );

    const systemPrompt = loadSystemPrompt();

    const response = await anthropicClient.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      logger.info(
        `✅ Anthropic response received: "${content.text.substring(0, 100)}..."`,
      );
      return convertToSlackFormat(content.text);
    } else {
      throw new Error("Unexpected response type from Anthropic");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Error calling Anthropic API: ${errorMessage}`);
    throw error;
  }
}

// Main message processing function
async function processMessage(
  message: string,
  client: any,
  channelId: string,
): Promise<string> {
  const validation = validateAndSanitizeInput(message);

  if (!validation.isValid) {
    return `Error: ${validation.error}`;
  }

  const sanitizedMessage = validation.sanitized;
  if (!sanitizedMessage) {
    return "Error: Invalid message after sanitization";
  }

  // Check for commands first
  const commandParsed = parseCommand(sanitizedMessage);
  if (commandParsed) {
    return await handleCommand(
      commandParsed.command,
      commandParsed.args,
      client,
      channelId,
    );
  }

  // If not a command, process with Anthropic
  try {
    return await processWithAnthropic(sanitizedMessage);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error: Failed to process message - ${errorMessage}`;
  }
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say, client }) => {
  try {
    const message = event.text || "";
    const userId = event.user;
    const channel = event.channel;

    logger.info(`📨 RECEIVED MENTION - Channel: ${channel}, User: ${userId}`);
    logger.info(`📝 Message Content: "${message}"`);

    const thinkingMessage = `<@${userId}> 🤔 Processing...`;
    const thinkingResponse = await say(thinkingMessage);
    logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

    const botResponse = await processMessage(message, client, channel);
    logger.info(`🤖 Bot Response: "${botResponse}"`);

    const finalResponse = `<@${userId}> ${botResponse}`;

    // Replace the thinking message with the final response
    if (thinkingResponse && thinkingResponse.ts) {
      await client.chat.update({
        channel: channel,
        ts: thinkingResponse.ts,
        text: finalResponse,
      });
      logger.info(`📤 UPDATED MESSAGE WITH FINAL RESPONSE: "${finalResponse}"`);
    } else {
      // Fallback to sending a new message if update fails
      await say(finalResponse);
      logger.info(`📤 SENT FINAL RESPONSE: "${finalResponse}"`);
    }
  } catch (error: unknown) {
    logger.error(
      `Error processing app mention: ${error instanceof Error ? error.message : String(error)}`,
    );
    const errorResponse = `<@${event.user}> Sorry, I encountered an error processing your request.`;
    await say(errorResponse);
    logger.info(`📤 SENT ERROR RESPONSE: "${errorResponse}"`);
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
      logger.info(`📝 Message Content: "${messageText}"`);

      const thinkingMessage = "🤔 Processing...";
      const thinkingResponse = await say(thinkingMessage);
      logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

      const botResponse = await processMessage(
        messageText,
        client,
        message.channel,
      );
      logger.info(`🤖 Bot Response: "${botResponse}"`);

      // Replace the thinking message with the final response
      if (thinkingResponse && thinkingResponse.ts) {
        await client.chat.update({
          channel: message.channel,
          ts: thinkingResponse.ts,
          text: botResponse,
        });
        logger.info(`📤 UPDATED MESSAGE WITH FINAL RESPONSE: "${botResponse}"`);
      } else {
        // Fallback to sending a new message if update fails
        await say(botResponse);
        logger.info(`📤 SENT FINAL RESPONSE: "${botResponse}"`);
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Error processing direct message: ${error instanceof Error ? error.message : String(error)}`,
    );
    const errorResponse =
      "Sorry, I encountered an error processing your message.";
    await say(errorResponse);
    logger.info(`📤 SENT ERROR RESPONSE: "${errorResponse}"`);
  }
});

// Application startup
void (async () => {
  try {
    // Initialize Anthropic first
    logger.info("🔧 Initializing Anthropic SDK before starting Slack bot...");
    initializeAnthropic();

    // Start Slack bot
    await app.start();
    logger.info("🚀 Slack bot started successfully with Anthropic SDK ready");
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
