import { spawn } from "child_process";
import { WebClient } from "@slack/web-api";
import express, { type Request, type Response } from "express";

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

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

// Handle URL verification challenge from Slack
app.post("/slack/events", (req: Request, res: Response) => {
  const { type, challenge } = req.body;

  // Respond to Slack's URL verification challenge
  if (type === "url_verification") {
    console.log("📋 Slack URL verification challenge received");
    return res.send(challenge as string);
  }

  // Handle app mention events
  if (type === "event_callback" && req.body.event?.type === "app_mention") {
    const event = req.body.event;

    // Process the mention in the background
    handleMention(event).catch(console.error);

    // Acknowledge the event immediately
    res.status(200).send("OK");
    return;
  }

  res.status(200).send("OK");
});

// Handle app mentions
async function handleMention(event: any) {
  try {
    const message = (event.text as string).replace(/<@[^>]+>/, "").trim();

    if (!message) {
      console.log("Empty message, skipping...");
      return;
    }

    console.log(`📨 Slack mention: "${message}"`);

    // Add thinking reaction
    await client.reactions.add({
      channel: event.channel,
      timestamp: event.ts,
      name: "thinking_face",
    });

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

    console.log("✅ Response sent successfully");
  } catch (error) {
    console.error("❌ Error handling mention:", error);

    try {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } catch (sendError) {
      console.error("Failed to send error message:", sendError);
    }
  }
}

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Start the server
function main() {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error("❌ SLACK_BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  app.listen(port, () => {
    console.log("🚀 Claude Slack Bot is running!");
    console.log(`📡 Server listening on port ${port}`);
    console.log(
      "💡 Mention @Claude Bot in Slack to send messages to Claude Code",
    );
    console.log(`🔗 Webhook URL: http://localhost:${port}/slack/events`);
  });
}

main();
