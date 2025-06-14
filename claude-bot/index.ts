import { spawn } from "child_process";
import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function runClaudeCommand(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`🧠 Claude Code: "${message}"`);

    const claude = spawn("claude", [message], {
      cwd:
        process.env.XMTP_REPO_PATH ||
        "/Users/fabrizioguespe/DevRel/xmtp-qa-tools",
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let error = "";

    claude.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    claude.stderr.on("data", (data: Buffer) => {
      error += data.toString();
    });

    claude.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim() || "Claude completed successfully");
      } else {
        reject(new Error(`Claude error (${code}): ${error}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      claude.kill();
      reject(new Error("Claude timeout (30s)"));
    }, 30000);
  });
}

// Listen for mentions
app.event(
  "app_mention",
  async ({ event, client }: { event: any; client: any }) => {
    try {
      const message = (event.text as string).replace(/<@[^>]+>/, "").trim();

      // Add thinking reaction
      await client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: "thinking_face",
      });

      console.log(`📨 Slack: "${message}"`);

      // Run Claude Code with the message
      const response = await runClaudeCommand(message);

      // Post response in thread
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `🤖 Claude Code Response:\n\`\`\`\n${response}\n\`\`\``,
      });

      // Remove thinking reaction
      await client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: "thinking_face",
      });
    } catch (error) {
      console.error("❌ Error:", error);

      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
);

// Start the app
void (async () => {
  await app.start();
  console.log("⚡️ Slack Claude Bot running!");
  console.log("💡 Mention the bot in Slack to send messages to Claude Code");
})();
