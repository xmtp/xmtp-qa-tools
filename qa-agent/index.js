const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

dotenv.config();

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
  const claudeResponse = await runClaudeCommand(event.text);
  await say(`<@${event.user}> ${claudeResponse}`);
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
  console.log("Message received:", message.text);

  try {
    // Get channel info to verify if it's a DM
    const channelInfo = await client.conversations.info({
      channel: message.channel,
    });

    if (channelInfo.channel.is_im) {
      const claudeResponse = await runClaudeCommand(message.text);
      await say(`${claudeResponse}`);
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

// Respond to /qa slash command
app.command("/qa", async ({ command, ack, respond }) => {
  console.log("Slash command received:", command.text);
  await ack();
  const claudeResponse = await runClaudeCommand(command.text);
  await respond(`<@${command.user_id}> ${claudeResponse}`);
});

(async () => {
  console.log("Starting Slack bot...");
  await app.start();
})();
