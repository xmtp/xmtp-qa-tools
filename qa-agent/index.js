const dotenv = require("dotenv");
const { App, LogLevel } = require("@slack/bolt");
const Anthropic = require("@anthropic-ai/sdk");

dotenv.config();
console.log(process.env.SLACK_BOT_TOKEN);
console.log(process.env.SLACK_APP_TOKEN);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // Required for Socket Mode
  socketMode: true,
  logLevel: LogLevel.INFO,
});

async function getClaudeResponse(message) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: message }],
    });
    return response.content[0].text;
  } catch (error) {
    console.error("Error calling Claude:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
}

// Respond to @mentions
app.event("app_mention", async ({ event, say }) => {
  const claudeResponse = await getClaudeResponse(event.text);
  await say(`<@${event.user}> ${claudeResponse}`);
});

// Respond to direct messages (optional, only if not a bot message)
app.message(async ({ message, say }) => {
  if (!("subtype" in message)) {
    const claudeResponse = await getClaudeResponse(message.text);
    await say(`<@${message.user}> ${claudeResponse}`);
  }
});

// Respond to /qa slash command
app.command("/qa", async ({ command, ack, respond }) => {
  await ack();
  const claudeResponse = await getClaudeResponse(command.text);
  await respond(`<@${command.user_id}> ${claudeResponse}`);
});

(async () => {
  await app.start();
  console.log("⚡️ QA Agent (Bolt + Socket Mode) is running!");
})();
