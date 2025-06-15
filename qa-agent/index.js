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
    message,
    timestamp: new Date().toISOString(),
  });

  try {
    // Get channel info to verify if it's a DM
    const channelInfo = await client.conversations.info({
      channel: message.channel,
    });

    console.log("Channel info:", channelInfo);

    if (channelInfo.channel.is_im) {
      console.log("Processing DM message");
      const claudeResponse = await runClaudeCommand(message.text);
      await say(`<@${message.user}> ${claudeResponse}`);
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
