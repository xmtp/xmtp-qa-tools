const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");
const { spawn } = require("child_process");

dotenv.config();

// Store active threads for users
const userThreads = new Map();

// Helper function to determine if a message is a new topic
function isNewTopic(message, userId) {
  const userHistory = userThreads.get(userId);
  if (!userHistory || userHistory.length === 0) {
    return true;
  }

  // Simple heuristic: if the message is significantly different from recent messages
  // or contains question words, treat it as a new topic
  const lastMessage = userHistory[userHistory.length - 1];
  const timeDiff = Date.now() - lastMessage.timestamp;

  // Start new thread if last message was more than 10 minutes ago
  if (timeDiff > 10 * 60 * 1000) {
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

  return topicIndicators.some((indicator) => lowerMessage.includes(indicator));
}

// Helper function to store thread info
function storeThreadInfo(userId, threadTs, channel, message) {
  if (!userThreads.has(userId)) {
    userThreads.set(userId, []);
  }

  const userHistory = userThreads.get(userId);
  userHistory.push({
    threadTs,
    channel,
    message: message.substring(0, 100), // Store first 100 chars for context
    timestamp: Date.now(),
  });

  // Keep only last 5 threads per user to avoid memory bloat
  if (userHistory.length > 5) {
    userHistory.splice(0, userHistory.length - 5);
  }
}

// Helper function to get current thread for user
function getCurrentThread(userId, channel) {
  const userHistory = userThreads.get(userId);
  if (!userHistory || userHistory.length === 0) {
    return null;
  }

  // Find the most recent thread for this channel
  for (let i = userHistory.length - 1; i >= 0; i--) {
    if (userHistory[i].channel === channel) {
      const timeDiff = Date.now() - userHistory[i].timestamp;
      // Only return thread if it's less than 10 minutes old
      if (timeDiff < 10 * 60 * 1000) {
        return userHistory[i].threadTs;
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
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", "),
  );
  process.exit(1);
}

console.log("✅ Environment variables validated");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

// Add error handler
app.error(async (error) => {
  console.error("App error:", error);
});

// Input validation and sanitization
function validateAndSanitizeInput(input) {
  if (!input || typeof input !== "string") {
    return { isValid: false, error: "Invalid input" };
  }

  const trimmed = input.trim();

  // Check length limits
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

async function runClaudeCommand(message) {
  const validation = validateAndSanitizeInput(message);

  if (!validation.isValid) {
    console.error("Input validation failed:", validation.error);
    return `Error: ${validation.error}`;
  }

  return new Promise((resolve) => {
    console.log(
      "Running claude command for message:",
      validation.sanitized.substring(0, 100) + "...",
    );

    const claude = spawn("claude", [], {
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
        claude.kill("SIGTERM");
        resolve("Error: Claude command timed out");
      }
    }, 30000);

    claude.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    claude.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    claude.on("close", (code) => {
      clearTimeout(timeout);
      if (!hasResponded) {
        hasResponded = true;
        if (code === 0) {
          resolve(stdout || "No response from Claude");
        } else {
          console.error(
            "Claude command failed with code:",
            code,
            "stderr:",
            stderr,
          );
          resolve("Error: Claude command failed");
        }
      }
    });

    claude.on("error", (error) => {
      clearTimeout(timeout);
      if (!hasResponded) {
        hasResponded = true;
        console.error("Error spawning claude command:", error);
        resolve("Error: Failed to run Claude command");
      }
    });

    // Send the message to claude via stdin
    claude.stdin.write(validation.sanitized);
    claude.stdin.end();
  });
}

// Helper function to send thinking message and update it with response
async function sendThinkingMessage(
  say,
  client,
  channel,
  userMention = "",
  threadTs = null,
) {
  try {
    // Send initial thinking message
    const messageOptions = {
      text: `${userMention}🤔 Thinking...`,
    };

    if (threadTs) {
      messageOptions.thread_ts = threadTs;
    }

    const thinkingResponse = await say(messageOptions);

    return {
      update: async (finalMessage) => {
        try {
          if (thinkingResponse && thinkingResponse.ts) {
            const updateOptions = {
              channel: channel,
              ts: thinkingResponse.ts,
              text: `${userMention}${finalMessage}`,
            };

            if (threadTs) {
              updateOptions.thread_ts = threadTs;
            }

            await client.chat.update(updateOptions);
          } else {
            // Fallback: send new message if update fails
            const fallbackOptions = {
              text: `${userMention}${finalMessage}`,
            };

            if (threadTs) {
              fallbackOptions.thread_ts = threadTs;
            }

            await say(fallbackOptions);
          }
        } catch (updateError) {
          console.error("Failed to update thinking message:", updateError);
          // Fallback: send new message
          const fallbackOptions = {
            text: `${userMention}${finalMessage}`,
          };

          if (threadTs) {
            fallbackOptions.thread_ts = threadTs;
          }

          await say(fallbackOptions);
        }
      },
      threadTs: thinkingResponse?.ts || threadTs,
    };
  } catch (error) {
    console.error("Failed to send thinking message:", error);
    // Return fallback that just sends the final message
    return {
      update: async (finalMessage) => {
        const fallbackOptions = {
          text: `${userMention}${finalMessage}`,
        };

        if (threadTs) {
          fallbackOptions.thread_ts = threadTs;
        }

        await say(fallbackOptions);
      },
      threadTs: threadTs,
    };
  }
}

// Respond to @mentions
app.event("app_mention", async ({ event, say, client }) => {
  try {
    console.log("App mention received from user:", event.user);

    const userId = event.user;
    const channel = event.channel;
    const message = event.text;

    let threadTs = null;

    // Check if this should start a new thread or continue existing one
    if (isNewTopic(message, userId)) {
      console.log("Starting new thread for user:", userId);
      // Don't set threadTs - this will start a new thread
    } else {
      threadTs = getCurrentThread(userId, channel);
      if (threadTs) {
        console.log("Continuing existing thread:", threadTs);
      } else {
        console.log("No recent thread found, starting new thread");
      }
    }

    const thinkingMsg = await sendThinkingMessage(
      say,
      client,
      channel,
      `<@${userId}> `,
      threadTs,
    );

    const claudeResponse = await runClaudeCommand(message);
    await thinkingMsg.update(claudeResponse);

    // Store thread info for future reference
    const finalThreadTs = thinkingMsg.threadTs || threadTs;
    if (finalThreadTs) {
      storeThreadInfo(userId, finalThreadTs, channel, message);
    }
  } catch (error) {
    console.error("Error processing app mention:", error);
    await say(
      `<@${event.user}> Sorry, I encountered an error processing your request.`,
    );
  }
});

// Respond to direct messages
app.message(async ({ message, say, client }) => {
  // Skip bot messages to avoid loops
  if (message.bot_id || message.subtype === "bot_message") {
    return;
  }

  // Skip messages without text
  if (!message.text || !message.text.trim()) {
    return;
  }

  console.log("Message received:", message.text.substring(0, 100) + "...");

  try {
    // Get channel info to verify if it's a DM
    const channelInfo = await client.conversations.info({
      channel: message.channel,
    });

    if (channelInfo.channel.is_im) {
      const userId = message.user;
      const channel = message.channel;
      const messageText = message.text;

      let threadTs = null;

      // Check if this should start a new thread or continue existing one
      if (isNewTopic(messageText, userId)) {
        console.log("Starting new thread for user:", userId);
        // Don't set threadTs - this will start a new thread
      } else {
        threadTs = getCurrentThread(userId, channel);
        if (threadTs) {
          console.log("Continuing existing thread:", threadTs);
        } else {
          console.log("No recent thread found, starting new thread");
        }
      }

      const thinkingMsg = await sendThinkingMessage(
        say,
        client,
        channel,
        "",
        threadTs,
      );

      const claudeResponse = await runClaudeCommand(messageText);
      await thinkingMsg.update(claudeResponse);

      // Store thread info for future reference
      const finalThreadTs = thinkingMsg.threadTs || threadTs;
      if (finalThreadTs) {
        storeThreadInfo(userId, finalThreadTs, channel, messageText);
      }
    }
  } catch (error) {
    console.error("Error processing message:", error);
    try {
      await say("Sorry, I encountered an error processing your message.");
    } catch (sendError) {
      console.error("Failed to send error response:", sendError);
    }
  }
});

// Respond to /qa slash command
app.command("/qa", async ({ command, ack, respond, client }) => {
  console.log(
    "Slash command received:",
    command.text.substring(0, 100) + "...",
  );
  await ack();

  try {
    const userId = command.user_id;
    const channel = command.channel_id;
    const message = command.text;

    let threadTs = null;

    // Check if this should start a new thread or continue existing one
    if (isNewTopic(message, userId)) {
      console.log("Starting new thread for slash command user:", userId);
      // Don't set threadTs - this will start a new thread
    } else {
      threadTs = getCurrentThread(userId, channel);
      if (threadTs) {
        console.log("Continuing existing thread:", threadTs);
      } else {
        console.log("No recent thread found, starting new thread");
      }
    }

    // Send initial thinking response
    const initialOptions = {
      text: `<@${userId}> 🤔 Thinking...`,
    };

    if (threadTs) {
      initialOptions.thread_ts = threadTs;
    }

    const initialResponse = await respond(initialOptions);
    const claudeResponse = await runClaudeCommand(message);

    // Send follow-up response with actual result
    const followUpOptions = {
      channel: channel,
      text: `<@${userId}> ${claudeResponse}`,
    };

    if (threadTs) {
      followUpOptions.thread_ts = threadTs;
    }

    const finalResponse = await client.chat.postMessage(followUpOptions);

    // Store thread info for future reference
    const finalThreadTs = threadTs || finalResponse.ts;
    if (finalThreadTs) {
      storeThreadInfo(userId, finalThreadTs, channel, message);
    }
  } catch (error) {
    console.error("Error processing slash command:", error);
    await respond(
      `<@${command.user_id}> Sorry, I encountered an error processing your request.`,
    );
  }
});

(async () => {
  console.log("Starting Slack bot...");
  try {
    await app.start();
    console.log("✅ Slack bot is running!");
  } catch (error) {
    console.error("❌ Failed to start Slack bot:", error);
    process.exit(1);
  }
})();
