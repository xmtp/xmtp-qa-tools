import { spawn, type ChildProcess } from "child_process";
import pkg, { type SayFn, type SlackCommandMiddlewareArgs } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import dotenv from "dotenv";

const { App, LogLevel } = pkg;

dotenv.config();

// Types for thread management
interface ThreadInfo {
  threadTs: string;
  channel: string;
  message: string;
  timestamp: number;
}

interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  error?: string;
}

interface ThinkingMessage {
  update: (finalMessage: string) => Promise<void>;
  threadTs: string | null;
}

// Store active threads for users
const userThreads = new Map<string, ThreadInfo[]>();

// Enhanced logging with timestamp and context
function logWithContext(
  level: "INFO" | "ERROR" | "DEBUG" | "WARN",
  message: string,
  context?: Record<string, any>,
) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${contextStr}`);
}

// Helper function to determine if a message is a new topic
function isNewTopic(message: string, userId: string): boolean {
  logWithContext("DEBUG", "Checking if message is new topic", {
    userId,
    messageLength: message.length,
  });

  const userHistory = userThreads.get(userId);
  if (!userHistory || userHistory.length === 0) {
    logWithContext("DEBUG", "No user history found, treating as new topic", {
      userId,
    });
    return true;
  }

  // Simple heuristic: if the message is significantly different from recent messages
  // or contains question words, treat it as a new topic
  const lastMessage = userHistory[userHistory.length - 1];
  const timeDiff = Date.now() - lastMessage.timestamp;

  logWithContext("DEBUG", "Analyzing message timing", {
    userId,
    timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
    lastMessagePreview: lastMessage.message.substring(0, 50),
  });

  // Start new thread if last message was more than 10 minutes ago
  if (timeDiff > 10 * 60 * 1000) {
    logWithContext("INFO", "Starting new thread due to time gap", {
      userId,
      timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
    });
    return true;
  }

  // Check for topic indicators (questions, greetings, etc.)
  const topicIndicators = [
    "what",
    "how",
    "why",
    "when",
    "where",
    "can you",
    "help me",
    "i need",
    "question",
    "problem",
  ];
  const lowerMessage = message.toLowerCase();

  const hasTopicIndicator = topicIndicators.some((indicator) =>
    lowerMessage.includes(indicator),
  );

  if (hasTopicIndicator) {
    logWithContext(
      "INFO",
      "Starting new thread due to topic indicator detected",
      {
        userId,
        detectedIndicators: topicIndicators.filter((indicator) =>
          lowerMessage.includes(indicator),
        ),
      },
    );
  }

  return hasTopicIndicator;
}

// Helper function to store thread info
function storeThreadInfo(
  userId: string,
  threadTs: string,
  channel: string,
  message: string,
): void {
  logWithContext("DEBUG", "Storing thread info", {
    userId,
    threadTs,
    channel,
    messagePreview: message.substring(0, 50),
  });

  if (!userThreads.has(userId)) {
    userThreads.set(userId, []);
    logWithContext("DEBUG", "Created new thread history for user", { userId });
  }

  const userHistory = userThreads.get(userId) || [];
  userHistory.push({
    threadTs,
    channel,
    message: message.substring(0, 100), // Store first 100 chars for context
    timestamp: Date.now(),
  });

  // Keep only last 5 threads per user to avoid memory bloat
  if (userHistory.length > 5) {
    const removedCount = userHistory.length - 5;
    userHistory.splice(0, removedCount);
    logWithContext("DEBUG", "Trimmed thread history", {
      userId,
      removedCount,
      remainingThreads: userHistory.length,
    });
  }

  logWithContext("INFO", "Thread info stored successfully", {
    userId,
    threadTs,
    totalThreadsForUser: userHistory.length,
  });
}

// Helper function to get current thread for user
function getCurrentThread(userId: string, channel: string): string | null {
  logWithContext("DEBUG", "Looking for current thread", { userId, channel });

  const userHistory = userThreads.get(userId);
  if (!userHistory || userHistory.length === 0) {
    logWithContext("DEBUG", "No thread history found for user", { userId });
    return null;
  }

  // Find the most recent thread for this channel
  for (let i = userHistory.length - 1; i >= 0; i--) {
    if (userHistory[i].channel === channel) {
      const timeDiff = Date.now() - userHistory[i].timestamp;
      const timeDiffMinutes = Math.round(timeDiff / (60 * 1000));

      logWithContext("DEBUG", "Found thread candidate", {
        userId,
        threadTs: userHistory[i].threadTs,
        timeDiffMinutes,
      });

      // Only return thread if it's less than 10 minutes old
      if (timeDiff < 10 * 60 * 1000) {
        logWithContext("INFO", "Using existing thread", {
          userId,
          threadTs: userHistory[i].threadTs,
          timeDiffMinutes,
        });
        return userHistory[i].threadTs;
      } else {
        logWithContext("INFO", "Thread too old, will create new one", {
          userId,
          timeDiffMinutes,
        });
        break;
      }
    }
  }

  return null;
}

// Validate required environment variables
const requiredEnvVars = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  logWithContext("ERROR", "Missing required environment variables", {
    missingVars: missingEnvVars,
  });
  process.exit(1);
}

logWithContext("INFO", "Environment variables validated successfully");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN as string,
  appToken: process.env.SLACK_APP_TOKEN as string,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

// Add enhanced error handler
app.error(async (error: unknown) => {
  logWithContext("ERROR", "App error occurred", {
    errorMessage: error.message,
    errorStack: error.stack,
    errorName: error.name,
  });
});

// Input validation and sanitization
function validateAndSanitizeInput(input: string): ValidationResult {
  logWithContext("DEBUG", "Validating input", {
    inputLength: input?.length || 0,
  });

  if (!input || typeof input !== "string") {
    logWithContext("WARN", "Invalid input type received", {
      inputType: typeof input,
    });
    return { isValid: false, error: "Invalid input" };
  }

  const trimmed = input.trim();

  // Check length limits
  if (trimmed.length === 0) {
    logWithContext("WARN", "Empty message received");
    return { isValid: false, error: "Empty message" };
  }

  if (trimmed.length > 4000) {
    logWithContext("WARN", "Message too long", { length: trimmed.length });
    return { isValid: false, error: "Message too long (max 4000 characters)" };
  }

  // Remove or escape potentially dangerous characters
  const sanitized = trimmed.replace(/[`$\\]/g, "\\$&");

  logWithContext("DEBUG", "Input validation successful", {
    originalLength: input.length,
    sanitizedLength: sanitized.length,
    charactersEscaped: sanitized !== trimmed,
  });

  return { isValid: true, sanitized };
}

async function runClaudeCommand(message: string): Promise<string> {
  const startTime = Date.now();
  logWithContext("INFO", "Starting Claude command execution", {
    messagePreview: message.substring(0, 100) + "...",
    messageLength: message.length,
  });

  const validation = validateAndSanitizeInput(message);

  if (!validation.isValid) {
    logWithContext("ERROR", "Input validation failed for Claude command", {
      error: validation.error,
    });
    return `Error: ${validation.error}`;
  }

  return new Promise((resolve) => {
    logWithContext("DEBUG", "Spawning Claude process");

    const claude: ChildProcess = spawn("claude", [], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000, // 30 second timeout
    });

    let stdout = "";
    let stderr = "";
    let hasResponded = false;

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        logWithContext("ERROR", "Claude command timed out", {
          executionTime: Date.now() - startTime,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });
        claude.kill("SIGTERM");
        resolve("Error: Claude command timed out");
      }
    }, 30000);

    claude.stdout?.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      logWithContext("DEBUG", "Received stdout chunk", {
        chunkLength: chunk.length,
        totalLength: stdout.length,
      });
    });

    claude.stderr?.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      logWithContext("WARN", "Received stderr chunk", {
        chunkLength: chunk.length,
        errorPreview: chunk.substring(0, 100),
      });
    });

    claude.on("close", (code) => {
      clearTimeout(timeout);
      const executionTime = Date.now() - startTime;

      if (!hasResponded) {
        hasResponded = true;
        if (code === 0) {
          logWithContext("INFO", "Claude command completed successfully", {
            executionTime,
            responseLength: stdout.length,
            exitCode: code,
          });
          resolve(stdout || "No response from Claude");
        } else {
          logWithContext("ERROR", "Claude command failed", {
            exitCode: code,
            executionTime,
            stderrPreview: stderr.substring(0, 200),
            stdoutLength: stdout.length,
          });
          resolve("Error: Claude command failed");
        }
      }
    });

    claude.on("error", (error) => {
      clearTimeout(timeout);
      if (!hasResponded) {
        hasResponded = true;
        logWithContext("ERROR", "Error spawning Claude command", {
          errorMessage: error.message,
          executionTime: Date.now() - startTime,
        });
        resolve("Error: Failed to run Claude command");
      }
    });

    // Send the message to claude via stdin
    if (claude.stdin && validation.sanitized) {
      logWithContext("DEBUG", "Sending input to Claude process");
      claude.stdin.write(validation.sanitized);
      claude.stdin.end();
    } else {
      logWithContext("ERROR", "Failed to write to Claude stdin");
      resolve("Error: Failed to send input to Claude");
    }
  });
}

// Helper function to send thinking message and update it with response
async function sendThinkingMessage(
  say: SayFn,
  client: WebClient,
  channel: string,
  userMention: string = "",
  threadTs: string | null = null,
): Promise<ThinkingMessage> {
  logWithContext("DEBUG", "Sending thinking message", {
    channel,
    userMention,
    threadTs,
  });

  try {
    // Send initial thinking message
    const messageOptions: any = {
      text: `${userMention}🤔 Thinking...`,
    };

    if (threadTs) {
      messageOptions.thread_ts = threadTs;
      logWithContext("DEBUG", "Adding thread_ts to thinking message", {
        threadTs,
      });
    }

    const thinkingResponse = await say(messageOptions);

    logWithContext("INFO", "Thinking message sent successfully", {
      channel,
      messageTs: thinkingResponse?.ts,
      isThreaded: !!threadTs,
    });

    return {
      update: async (finalMessage: string) => {
        logWithContext(
          "DEBUG",
          "Updating thinking message with final response",
          {
            messageLength: finalMessage.length,
            originalTs: thinkingResponse?.ts,
          },
        );

        try {
          if (thinkingResponse && thinkingResponse.ts) {
            const updateOptions: any = {
              channel: channel,
              ts: thinkingResponse.ts,
              text: `${userMention}${finalMessage}`,
            };

            if (threadTs) {
              updateOptions.thread_ts = threadTs;
            }

            await client.chat.update(updateOptions);
            logWithContext("INFO", "Thinking message updated successfully", {
              channel,
              messageTs: thinkingResponse.ts,
            });
          } else {
            // Fallback: send new message if update fails
            logWithContext(
              "WARN",
              "No message timestamp available, sending new message as fallback",
            );
            const fallbackOptions: any = {
              text: `${userMention}${finalMessage}`,
            };

            if (threadTs) {
              fallbackOptions.thread_ts = threadTs;
            }

            await say(fallbackOptions);
            logWithContext("INFO", "Fallback message sent successfully");
          }
        } catch (updateError: any) {
          logWithContext("ERROR", "Failed to update thinking message", {
            errorMessage: updateError.message,
            channel,
            originalTs: thinkingResponse?.ts,
          });

          // Fallback: send new message
          const fallbackOptions: any = {
            text: `${userMention}${finalMessage}`,
          };

          if (threadTs) {
            fallbackOptions.thread_ts = threadTs;
          }

          await say(fallbackOptions);
          logWithContext("INFO", "Fallback message sent after update failure");
        }
      },
      threadTs: thinkingResponse?.ts || threadTs,
    };
  } catch (error: any) {
    logWithContext("ERROR", "Failed to send thinking message", {
      errorMessage: error.message,
      channel,
      userMention,
    });

    // Return fallback that just sends the final message
    return {
      update: async (finalMessage: string) => {
        logWithContext("INFO", "Using fallback update method");
        const fallbackOptions: any = {
          text: `${userMention}${finalMessage}`,
        };

        if (threadTs) {
          fallbackOptions.thread_ts = threadTs;
        }

        await say(fallbackOptions);
        logWithContext("INFO", "Fallback message sent in update method");
      },
      threadTs: threadTs,
    };
  }
}

// Respond to @mentions
app.event<"app_mention">("app_mention", async ({ event, say, client }) => {
  const startTime = Date.now();
  logWithContext("INFO", "App mention received", {
    userId: event.user,
    channel: event.channel,
    messageLength: event.text?.length || 0,
    eventTs: event.ts,
  });

  try {
    const userId = event.user;
    const channel = event.channel;
    const message = event.text || "";

    let threadTs: string | null = null;

    // Check if this should start a new thread or continue existing one
    if (isNewTopic(message, userId)) {
      logWithContext("INFO", "Starting new thread for app mention", {
        userId,
      });
      // Don't set threadTs - this will start a new thread
    } else {
      threadTs = getCurrentThread(userId, channel);
      if (threadTs) {
        logWithContext("INFO", "Continuing existing thread for app mention", {
          userId,
          threadTs,
        });
      } else {
        logWithContext(
          "INFO",
          "No recent thread found, starting new thread for app mention",
          { userId },
        );
      }
    }

    const thinkingMsg = await sendThinkingMessage(
      say,
      client,
      channel,
      `<@${userId}> `,
      threadTs,
    );

    logWithContext("DEBUG", "Executing Claude command for app mention");
    const claudeResponse = await runClaudeCommand(message);

    await thinkingMsg.update(claudeResponse);

    // Store thread info for future reference
    const finalThreadTs = thinkingMsg.threadTs || threadTs;
    if (finalThreadTs) {
      storeThreadInfo(userId, finalThreadTs, channel, message);
    }

    const processingTime = Date.now() - startTime;
    logWithContext("INFO", "App mention processed successfully", {
      userId,
      processingTime,
      responseLength: claudeResponse.length,
      finalThreadTs,
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logWithContext("ERROR", "Error processing app mention", {
      errorMessage: error.message,
      errorStack: error.stack,
      userId: event.user,
      processingTime,
    });

    await say(
      `<@${event.user}> Sorry, I encountered an error processing your request.`,
    );
  }
});

// Respond to direct messages
app.message(async ({ message, say, client }) => {
  // Skip bot messages to avoid loops
  if (message.bot_id || message.subtype === "bot_message") {
    logWithContext("DEBUG", "Skipping bot message to avoid loops", {
      botId: message.bot_id,
      subtype: message.subtype,
    });
    return;
  }

  // Skip messages without text
  if (!message.text || !message.text.trim()) {
    logWithContext("DEBUG", "Skipping message without text");
    return;
  }

  const startTime = Date.now();
  const messageEvent = message;

  logWithContext("INFO", "Direct message received", {
    messagePreview: messageEvent.text?.substring(0, 100) + "...",
    messageLength: messageEvent.text?.length || 0,
    userId: messageEvent.user,
    channel: messageEvent.channel,
  });

  try {
    // Get channel info to verify if it's a DM
    logWithContext("DEBUG", "Checking if channel is DM", {
      channel: messageEvent.channel,
    });
    const channelInfo = await client.conversations.info({
      channel: messageEvent.channel,
    });

    logWithContext("DEBUG", "Channel info retrieved", {
      isIm: channelInfo.channel?.is_im,
      channelType: channelInfo.channel?.is_im ? "DM" : "other",
    });

    if (channelInfo.channel?.is_im) {
      const userId = messageEvent.user!;
      const channel = messageEvent.channel;
      const messageText = messageEvent.text!;

      let threadTs: string | null = null;

      // Check if this should start a new thread or continue existing one
      if (isNewTopic(messageText, userId)) {
        logWithContext("INFO", "Starting new thread for DM", { userId });
        // Don't set threadTs - this will start a new thread
      } else {
        threadTs = getCurrentThread(userId, channel);
        if (threadTs) {
          logWithContext("INFO", "Continuing existing thread for DM", {
            userId,
            threadTs,
          });
        } else {
          logWithContext(
            "INFO",
            "No recent thread found, starting new thread for DM",
            { userId },
          );
        }
      }

      const thinkingMsg = await sendThinkingMessage(
        say,
        client,
        channel,
        "",
        threadTs,
      );

      logWithContext("DEBUG", "Executing Claude command for DM");
      const claudeResponse = await runClaudeCommand(messageText);

      await thinkingMsg.update(claudeResponse);

      // Store thread info for future reference
      const finalThreadTs = thinkingMsg.threadTs || threadTs;
      if (finalThreadTs) {
        storeThreadInfo(userId, finalThreadTs, channel, messageText);
      }

      const processingTime = Date.now() - startTime;
      logWithContext("INFO", "Direct message processed successfully", {
        userId,
        processingTime,
        responseLength: claudeResponse.length,
        finalThreadTs,
      });
    } else {
      logWithContext("DEBUG", "Message not from DM channel, ignoring", {
        channel: messageEvent.channel,
        isIm: channelInfo.channel?.is_im,
      });
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logWithContext("ERROR", "Error processing direct message", {
      errorMessage: error.message,
      errorStack: error.stack,
      userId: messageEvent.user,
      channel: messageEvent.channel,
      processingTime,
    });

    try {
      await say("Sorry, I encountered an error processing your message.");
    } catch (sendError: any) {
      logWithContext("ERROR", "Failed to send error response", {
        errorMessage: sendError.message,
        originalError: error.message,
      });
    }
  }
});

// Respond to /qa slash command
app.command(
  "/qa",
  async ({ command, ack, respond, client }: SlackCommandMiddlewareArgs) => {
    const startTime = Date.now();
    logWithContext("INFO", "Slash command received", {
      userId: command.user_id,
      channel: command.channel_id,
      commandText: command.text?.substring(0, 100) + "...",
      commandLength: command.text?.length || 0,
      triggerId: command.trigger_id,
    });

    await ack();
    logWithContext("DEBUG", "Slash command acknowledged");

    try {
      const userId = command.user_id;
      const channel = command.channel_id;
      const message = command.text;

      let threadTs: string | null = null;

      // Check if this should start a new thread or continue existing one
      if (isNewTopic(message, userId)) {
        logWithContext("INFO", "Starting new thread for slash command", {
          userId,
        });
        // Don't set threadTs - this will start a new thread
      } else {
        threadTs = getCurrentThread(userId, channel);
        if (threadTs) {
          logWithContext(
            "INFO",
            "Continuing existing thread for slash command",
            { userId, threadTs },
          );
        } else {
          logWithContext(
            "INFO",
            "No recent thread found, starting new thread for slash command",
            { userId },
          );
        }
      }

      // Send initial thinking response
      const initialOptions: any = {
        text: `<@${userId}> 🤔 Thinking...`,
      };

      if (threadTs) {
        initialOptions.thread_ts = threadTs;
      }

      logWithContext("DEBUG", "Sending initial slash command response");
      const initialResponse = await respond(initialOptions);

      logWithContext("DEBUG", "Executing Claude command for slash command");
      const claudeResponse = await runClaudeCommand(message);

      // Send follow-up response with actual result
      const followUpOptions: any = {
        channel: channel,
        text: `<@${userId}> ${claudeResponse}`,
      };

      if (threadTs) {
        followUpOptions.thread_ts = threadTs;
      }

      logWithContext("DEBUG", "Sending follow-up slash command response");
      const finalResponse = await client.chat.postMessage(followUpOptions);

      // Store thread info for future reference
      const finalThreadTs = threadTs || finalResponse.ts!;
      if (finalThreadTs) {
        storeThreadInfo(userId, finalThreadTs, channel, message);
      }

      const processingTime = Date.now() - startTime;
      logWithContext("INFO", "Slash command processed successfully", {
        userId,
        processingTime,
        responseLength: claudeResponse.length,
        finalThreadTs,
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logWithContext("ERROR", "Error processing slash command", {
        errorMessage: error.message,
        errorStack: error.stack,
        userId: command.user_id,
        processingTime,
      });

      await respond(
        `<@${command.user_id}> Sorry, I encountered an error processing your request.`,
      );
    }
  },
);

// Application startup
(async () => {
  logWithContext("INFO", "Starting Slack bot application");

  try {
    const startTime = Date.now();
    await app.start();
    const startupTime = Date.now() - startTime;

    logWithContext("INFO", "Slack bot started successfully", {
      startupTime,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    // Log memory usage on startup
    const memoryUsage = process.memoryUsage();
    logWithContext("INFO", "Memory usage on startup", {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB",
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
      external: Math.round(memoryUsage.external / 1024 / 1024) + "MB",
    });

    // Log environment info
    logWithContext("INFO", "Environment information", {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      workingDirectory: process.cwd(),
    });
  } catch (error: any) {
    logWithContext("ERROR", "Failed to start Slack bot", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    process.exit(1);
  }
})();

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logWithContext("INFO", "Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logWithContext("INFO", "Received SIGINT, shutting down gracefully");
  process.exit(0);
});

// Log unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logWithContext("ERROR", "Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise),
  });
});

// Log uncaught exceptions
process.on("uncaughtException", (error) => {
  logWithContext("ERROR", "Uncaught Exception", {
    errorMessage: error.message,
    errorStack: error.stack,
    errorName: error.name,
  });
  process.exit(1);
});
