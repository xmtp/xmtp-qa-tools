import { spawn, type ChildProcess } from "child_process";
import { createLogger } from "@helpers/logger";
import pkg from "@slack/bolt";
import dotenv from "dotenv";

const { App, LogLevel } = pkg;

dotenv.config();

// Initialize logger
const logger = createLogger();

// Single persistent Claude process
let claudeProcess: ChildProcess | null = null;
let claudeReady = false;
let claudeInitializing = false;

// Message queue for handling requests
interface PendingMessage {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
  message: string;
  timestamp: number;
}

const messageQueue: PendingMessage[] = [];
let processingMessage = false;

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

  // Remove or escape potentially dangerous characters for safety
  const sanitized = trimmed.replace(/[`$\\]/g, "\\$&");

  return { isValid: true, sanitized };
}

async function initializeClaudeProcess(): Promise<void> {
  if (claudeInitializing || claudeReady) {
    return;
  }

  claudeInitializing = true;
  logger.info("🚀 Initializing persistent Claude process...");

  try {
    claudeProcess = spawn("npx", ["@anthropic-ai/claude-code"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
    });

    let initOutput = "";

    claudeProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      initOutput += output;

      // Process any queued messages when Claude is ready
      if (!processingMessage && messageQueue.length > 0) {
        processNextMessage();
      }
    });

    claudeProcess.stderr?.on("data", (data) => {
      const error = data.toString();
      logger.warn(`Claude stderr: ${error}`);
    });

    claudeProcess.on("close", (code) => {
      logger.warn(`Claude process closed with code: ${code}`);
      claudeReady = false;
      claudeProcess = null;

      // Reject any pending messages
      while (messageQueue.length > 0) {
        const pending = messageQueue.shift();
        if (pending) {
          pending.reject(new Error("Claude process closed unexpectedly"));
        }
      }
    });

    claudeProcess.on("error", (error) => {
      logger.error(`Claude process error: ${error.message}`);
      claudeReady = false;
      claudeProcess = null;
      claudeInitializing = false;

      // Reject any pending messages
      while (messageQueue.length > 0) {
        const pending = messageQueue.shift();
        if (pending) {
          pending.reject(error);
        }
      }
    });

    // Give Claude a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    claudeReady = true;
    claudeInitializing = false;
    logger.info("✅ Claude process initialized and ready");
  } catch (error) {
    claudeInitializing = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize Claude process: ${errorMessage}`);
    throw error;
  }
}

function processNextMessage(): void {
  if (
    processingMessage ||
    messageQueue.length === 0 ||
    !claudeReady ||
    !claudeProcess
  ) {
    return;
  }

  const pending = messageQueue.shift();
  if (!pending) return;

  processingMessage = true;

  logger.info(
    `📝 Processing message: "${pending.message.substring(0, 50)}..."`,
  );

  let responseBuffer = "";
  let responseStarted = false;
  const responseTimeout = setTimeout(() => {
    pending.reject(new Error("Claude response timeout"));
    processingMessage = false;
    processNextMessage(); // Process next message
  }, 30000); // 30 second timeout

  const dataHandler = (data: Buffer) => {
    const output = data.toString();
    responseBuffer += output;

    if (!responseStarted) {
      responseStarted = true;
    }

    // Simple heuristic: if we get a substantial response and it ends with a newline,
    // consider it complete. This might need adjustment based on Claude's output format.
    if (responseBuffer.length > 10 && output.includes("\n")) {
      claudeProcess?.stdout?.off("data", dataHandler);
      clearTimeout(responseTimeout);

      const response = responseBuffer.trim();
      logger.info(
        `✅ Claude response complete: ${response.substring(0, 100)}...`,
      );

      pending.resolve(response || "No response from Claude");
      processingMessage = false;

      // Process next message in queue
      setImmediate(() => {
        processNextMessage();
      });
    }
  };

  claudeProcess.stdout?.on("data", dataHandler);

  // Send the message to Claude
  if (claudeProcess.stdin) {
    claudeProcess.stdin.write(`${pending.message}\n`);
  } else {
    clearTimeout(responseTimeout);
    pending.reject(new Error("Claude process stdin not available"));
    processingMessage = false;
    processNextMessage();
  }
}

async function runClaudeCommand(message: string): Promise<string> {
  const validation = validateAndSanitizeInput(message);

  if (!validation.isValid) {
    return `Error: ${validation.error}`;
  }

  const sanitizedMessage = validation.sanitized;
  if (!sanitizedMessage) {
    return "Error: Invalid message after sanitization";
  }

  // Initialize Claude if not ready
  if (!claudeReady && !claudeInitializing) {
    try {
      await initializeClaudeProcess();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error: Failed to initialize Claude - ${errorMessage}`;
    }
  }

  // Wait for Claude to be ready
  let waitCount = 0;
  while (!claudeReady && waitCount < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    waitCount++;
  }

  if (!claudeReady) {
    return "Error: Claude process not ready after timeout";
  }

  return new Promise<string>((resolve, reject) => {
    messageQueue.push({
      resolve,
      reject,
      message: sanitizedMessage,
      timestamp: Date.now(),
    });

    // Start processing if not already processing
    if (!processingMessage) {
      processNextMessage();
    }

    // Timeout for the entire request
    setTimeout(() => {
      reject(new Error("Request timeout"));
    }, 60000); // 1 minute total timeout
  });
}

// Function to cleanup Claude process
function cleanupClaudeProcess() {
  if (claudeProcess && !claudeProcess.killed) {
    logger.info("🧹 Cleaning up Claude process");
    try {
      claudeProcess.kill("SIGTERM");
      claudeProcess = null;
      claudeReady = false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error killing Claude process: ${errorMessage}`);
    }
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

    const thinkingMessage = `<@${userId}> 🤔 Thinking...`;
    const thinkingResponse = await say(thinkingMessage);
    logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

    const claudeResponse = await runClaudeCommand(message);
    logger.info(`🤖 Claude Response: "${claudeResponse}"`);

    const finalResponse = `<@${userId}> ${claudeResponse}`;

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
      const thinkingResponse = await say(thinkingMessage);
      logger.info(`📤 SENT THINKING MESSAGE: "${thinkingMessage}"`);

      const claudeResponse = await runClaudeCommand(messageText);
      logger.info(`🤖 Claude Response: "${claudeResponse}"`);

      // Replace the thinking message with the final response
      if (thinkingResponse && thinkingResponse.ts) {
        await client.chat.update({
          channel: message.channel,
          ts: thinkingResponse.ts,
          text: claudeResponse,
        });
        logger.info(
          `📤 UPDATED MESSAGE WITH FINAL RESPONSE: "${claudeResponse}"`,
        );
      } else {
        // Fallback to sending a new message if update fails
        await say(claudeResponse);
        logger.info(`📤 SENT FINAL RESPONSE: "${claudeResponse}"`);
      }
    }
  } catch (error: any) {
    logger.error(`Error processing direct message: ${error.message}`);
    const errorResponse =
      "Sorry, I encountered an error processing your message.";
    await say(errorResponse);
    logger.info(`📤 SENT ERROR RESPONSE: "${errorResponse}"`);
  }
});

// Application startup
void (async () => {
  try {
    // Initialize Claude first
    logger.info("🔧 Initializing Claude process before starting Slack bot...");
    await initializeClaudeProcess();

    // Only start Slack bot after Claude is ready
    await app.start();
    logger.info("🚀 Slack bot started successfully with Claude ready");
  } catch (error: any) {
    logger.error(`Failed to start application: ${error.message}`);
    cleanupClaudeProcess();
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("🛑 Shutting down gracefully");
  cleanupClaudeProcess();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🛑 Shutting down gracefully");
  cleanupClaudeProcess();
  process.exit(0);
});
