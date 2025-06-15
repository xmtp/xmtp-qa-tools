const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

dotenv.config();
console.log("Starting bot with tokens:", {
  hasBotToken: !!process.env.SLACK_BOT_TOKEN,
  hasAppToken: !!process.env.SLACK_APP_TOKEN,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
});

// Add error handler
app.error(async (error) => {
  console.error("App error:", error);
});

async function runClaudeCommand(message) {
  try {
    const { stdout, stderr } = await execPromise(`echo "${message}" | claude`);
    return stdout || stderr;
  } catch (error) {
    console.error("Error running claude command:", error);
    return "Error running claude command";
  }
}

// Respond to @mentions
app.event("app_mention", async ({ event, say }) => {
  console.log(`[MENTION] From: ${event.user}, Text: ${event.text}`);
  const claudeResponse = await runClaudeCommand(event.text);
  await say(`<@${event.user}> ${claudeResponse}`);
});

// Respond to direct messages
app.message(async ({ message, say, client }) => {
  console.log("Message event received:", {
    channel: message.channel,
    user: message.user,
    text: message.text,
    bot_id: message.bot_id,
    subtype: message.subtype,
    timestamp: new Date().toISOString(),
  });

  // Skip bot messages to avoid loops
  if (message.bot_id || message.subtype === "bot_message") {
    console.log("Skipping bot message");
    return;
  }

  // Skip messages without text
  if (!message.text || !message.text.trim()) {
    console.log("Skipping message without text");
    return;
  }

  try {
    // Get channel info to verify if it's a DM
    const channelInfo = await client.conversations.info({
      channel: message.channel,
    });

    console.log("Channel info:", {
      is_im: channelInfo.channel.is_im,
      is_channel: channelInfo.channel.is_channel,
      is_group: channelInfo.channel.is_group,
      is_mpim: channelInfo.channel.is_mpim,
      name: channelInfo.channel.name,
    });

    if (channelInfo.channel.is_im) {
      console.log("Processing DM message:", message.text);
      const claudeResponse = await runClaudeCommand(message.text);
      console.log("Claude response:", claudeResponse);
      await say(`${claudeResponse}`);
      console.log("Response sent successfully");
    } else {
      console.log("Not a DM channel, ignoring message");
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

// Respond to /qa slash command
app.command("/qa", async ({ command, ack, respond }) => {
  await ack();
  console.log(`[SLASH] From: ${command.user_id}, Text: ${command.text}`);
  const claudeResponse = await runClaudeCommand(command.text);
  await respond(`<@${command.user_id}> ${claudeResponse}`);
});

(async () => {
  await app.start();
  console.log("⚡️ QA Agent (Bolt + Socket Mode) is running!");
})();
