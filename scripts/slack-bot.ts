import { spawn, type ChildProcess } from "child_process";
import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

// Track active Claude processes for cleanup
const activeClaudeProcesses = new Set<ChildProcess>();

interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  error?: string;
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

  // Remove or escape potentially dangerous characters
  const sanitized = trimmed.replace(/[`$\\]/g, "\\$&");

  return { isValid: true, sanitized };
}

async function runClaudeCommand(message: string): Promise<string> {
  const validation = validateAndSanitizeInput(message);

  if (!validation.isValid) {
    return `Error: ${validation.error}`;
  }

  return new Promise((resolve) => {
    logger.info(
      `🤖 Starting Claude command with message: "${validation.sanitized}"`,
    );

    // Run claude with proper workspace context and configuration
    // Use the same command as defined in package.json
    const claude: ChildProcess = spawn("npx", ["@anthropic-ai/claude-code"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000, // Increased to 2 minutes
      cwd: process.cwd(), // Ensure we're in the correct workspace directory
      env: {
        ...process.env, // Inherit all environment variables
      },
    });

    // Track this process for cleanup
    activeClaudeProcesses.add(claude);

    let stdout = "";
    let stderr = "";
    let hasResponded = false;

    const cleanup = () => {
      activeClaudeProcesses.delete(claude);
    };

    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        logger.warn("⏰ Claude command timed out after 2 minutes");
        claude.kill("SIGTERM");
        cleanup();
        resolve(
          "Error: Claude command timed out (2 minutes). Please try a simpler query or break it into smaller parts.",
        );
      }
    }, 120000); // 2 minutes timeout

    claude.stdout?.on("data", (data) => {
      stdout += (data as Buffer).toString();
    });

    claude.stderr?.on("data", (data) => {
      stderr += (data as Buffer).toString();
    });

    claude.on("close", (code) => {
      clearTimeout(timeout);
      cleanup();
      if (!hasResponded) {
        hasResponded = true;
        logger.info(`🏁 Claude command finished with code: ${code}`);
        if (code === 0) {
          resolve(stdout || "No response from Claude");
        } else {
          const errorMsg = stderr
            ? `Claude error: ${stderr}`
            : "Claude command failed";
          logger.error(`❌ Claude command failed: ${errorMsg}`);
          resolve(`Error: ${errorMsg}`);
        }
      }
    });

    claude.on("error", (error) => {
      clearTimeout(timeout);
      cleanup();
      if (!hasResponded) {
        hasResponded = true;
        logger.error(`💥 Claude spawn error: ${error.message}`);
        resolve(`Error: Failed to run Claude command - ${error.message}`);
      }
    });

    if (claude.stdin && validation.sanitized) {
      claude.stdin.write(validation.sanitized);
      claude.stdin.end();
    } else {
      cleanup();
      resolve("Error: Failed to send input to Claude");
    }
  });
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say }) => {
  try {
    const message = event.text || "";
    const userId = event.user;
    const channel = event.channel;

    logger.info(`📨 RECEIVED MENTION - Channel: ${channel}, User: ${userId}`);
    logger.info(`📝 Message Content: "${message}"`);

    const thinkingMessage = `<@${userId}> 🤔 Thinking...`;
    await say(thinkingMessage);
    logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

    const claudeResponse = await runClaudeCommand(message);
    logger.info(`🤖 Claude Response: "${claudeResponse}"`);

    const finalResponse = `<@${userId}> ${claudeResponse}`;
    await say(finalResponse);
    logger.info(`📤 SENT FINAL RESPONSE: "${finalResponse}"`);
  } catch (error: any) {
    logger.error(`Error processing app mention: ${error.message}`);
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

      const thinkingMessage = "🤔 Thinking...";
      await say(thinkingMessage);
      logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

      const claudeResponse = await runClaudeCommand(messageText);
      logger.info(`🤖 Claude Response: "${claudeResponse}"`);

      await say(claudeResponse);
      logger.info(`📤 SENT FINAL RESPONSE: "${claudeResponse}"`);
    }
  } catch (error: any) {
    logger.error(`Error processing direct message: ${error.message}`);
    const errorResponse =
      "Sorry, I encountered an error processing your message.";
    await say(errorResponse);
    logger.info(`📤 SENT ERROR RESPONSE: "${errorResponse}"`);
  }
});

// Function to cleanup all active Claude processes
function cleanupClaudeProcesses() {
  if (activeClaudeProcesses.size > 0) {
    logger.info(
      `🧹 Cleaning up ${activeClaudeProcesses.size} active Claude processes`,
    );

    for (const process of activeClaudeProcesses) {
      try {
        if (!process.killed) {
          process.kill("SIGTERM");
          logger.info("🔪 Terminated Claude process");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Error killing Claude process: ${errorMessage}`);
      }
    }

    activeClaudeProcesses.clear();
  }
}

// Application startup
void (async () => {
  try {
    await app.start();
    logger.info("🚀 Slack bot started successfully");
  } catch (error: any) {
    logger.error(`Failed to start Slack bot: ${error.message}`);
    cleanupClaudeProcesses();
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("🛑 Shutting down gracefully");
  cleanupClaudeProcesses();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🛑 Shutting down gracefully");
  cleanupClaudeProcesses();
  process.exit(0);
});
