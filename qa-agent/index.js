const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");
const { spawn } = require("child_process");

dotenv.config();

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
async function sendThinkingMessage(say, client, channel, userMention = "") {
  try {
    // Send initial thinking message
    const thinkingResponse = await say(`${userMention}🤔 Thinking...`);

    return {
      update: async (finalMessage) => {
        try {
          if (thinkingResponse && thinkingResponse.ts) {
            await client.chat.update({
              channel: channel,
              ts: thinkingResponse.ts,
              text: `${userMention}${finalMessage}`,
            });
          } else {
            // Fallback: send new message if update fails
            await say(`${userMention}${finalMessage}`);
          }
        } catch (updateError) {
          console.error("Failed to update thinking message:", updateError);
          // Fallback: send new message
          await say(`${userMention}${finalMessage}`);
        }
      },
    };
  } catch (error) {
    console.error("Failed to send thinking message:", error);
    // Return fallback that just sends the final message
    return {
      update: async (finalMessage) => {
        await say(`${userMention}${finalMessage}`);
      },
    };
  }
}

// Respond to @mentions
app.event("app_mention", async ({ event, say, client }) => {
  try {
    console.log("App mention received from user:", event.user);

    const thinkingMsg = await sendThinkingMessage(
      say,
      client,
      event.channel,
      `<@${event.user}> `,
    );
    const claudeResponse = await runClaudeCommand(event.text);
    await thinkingMsg.update(claudeResponse);
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
      const thinkingMsg = await sendThinkingMessage(
        say,
        client,
        message.channel,
      );
      const claudeResponse = await runClaudeCommand(message.text);
      await thinkingMsg.update(claudeResponse);
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
    // Send initial thinking response
    await respond(`<@${command.user_id}> 🤔 Thinking...`);

    const claudeResponse = await runClaudeCommand(command.text);

    // Send follow-up response with actual result
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `<@${command.user_id}> ${claudeResponse}`,
    });
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
