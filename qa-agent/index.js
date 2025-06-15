const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");

dotenv.config();
console.log(process.env.SLACK_BOT_TOKEN);
console.log(process.env.SLACK_APP_TOKEN);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // Required for Socket Mode
  socketMode: true,
  logLevel: LogLevel.INFO,
});

// Respond to @mentions
app.event("app_mention", async ({ event, say }) => {
  await say(`gm <@${event.user}>! 👋`);
});

// Respond to direct messages (optional, only if not a bot message)
app.message(async ({ message, say }) => {
  if (!("subtype" in message)) {
    await say(`gm <@${message.user}>! 👋`);
  }
});

// Respond to /qa slash command
app.command("/qa", async ({ command, ack, respond }) => {
  await ack();
  console.log(command);
  await respond(`gm <@${command.user_id}>! 👋`);
});

(async () => {
  await app.start();
  console.log("⚡️ QA Agent (Bolt + Socket Mode) is running!");
})();
