import { Agent, getTestUrl, type AgentMiddleware } from "@xmtp/agent-sdk";
import {
  ContentTypeReaction,
  ReactionCodec,
  type Reaction,
} from "@xmtp/content-type-reaction";
import {
  ContentTypeReply,
  ReplyCodec,
  type Reply,
} from "@xmtp/content-type-reply";

process.loadEnvFile(".env");

// Store message IDs for replies
const messageStore = new Map<string, string>();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ReactionCodec(), new ReplyCodec()],
});

// Store message IDs for replies and reactions
agent.on("text", async (ctx) => {
  // Store the message ID for potential replies/reactions
  messageStore.set(ctx.conversation.id, ctx.message.id);

  const messageContent = ctx.message.content.toLowerCase().trim();

  if (messageContent === "/help" || messageContent === "help") {
    await ctx.conversation.send(`🔧 XMTP UX Demo Bot - Available Commands:

**Text Commands:**
• \`/help\` - Show this help menu
• \`/reaction\` - Send a reaction to your message
• \`/reply\` - Send a reply to your message  
• \`/demo\` - Run all demo types in sequence

**Features:**
This bot demonstrates basic XMTP content types:
• Text messages 📝
• Reactions 👍
• Replies 💬

Send any message and try the commands above!`);
    return;
  }

  if (messageContent === "/demo") {
    await ctx.conversation.send("🚀 Running UX Demo: All message types...");

    // 1. Text message
    await ctx.conversation.send("1️⃣ Regular text message demo");

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Reply to the user's message
    const reply = {
      content: "2️⃣ This is a reply to your /demo command!",
      reference: ctx.message.id,
    };
    await ctx.conversation.send(reply, ContentTypeReply);

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Reaction to the user's message
    const reaction: Reaction = {
      action: "added",
      content: "🎉",
      reference: ctx.message.id,
      schema: "shortcode",
    };
    await ctx.conversation.send(reaction, ContentTypeReaction);

    await ctx.conversation.send(
      "✅ UX Demo complete! All message types demonstrated.",
    );
    return;
  }

  // Handle text commands
  if (messageContent === "/reaction") {
    const reaction: Reaction = {
      action: "added",
      content: "🎉",
      reference: ctx.message.id,
      schema: "shortcode",
    };
    await ctx.conversation.send(reaction, ContentTypeReaction);
    await ctx.conversation.send(
      "✅ Sent a celebration reaction to your message!",
    );
    return;
  }

  if (messageContent === "/reply") {
    const reply = {
      content: "This is a reply to your message using the Reply content type!",
      reference: ctx.message.id,
    };
    await ctx.conversation.send(reply, ContentTypeReply);
    await ctx.conversation.send(
      "✅ Sent a reply using the Reply content type!",
    );
    return;
  }

  // Default response for other messages
  await ctx.conversation.send(
    `📝 You sent: "${ctx.message.content}"

Send \`/help\` to see all available UX demos, or try:
• \`/reaction\` - Add a reaction
• \`/reply\` - Send a reply
• \`/demo\` - Run all demos`,
  );
});

// Handle received reactions
agent.on("reaction", async (ctx) => {
  const reaction = ctx.message.content as Reaction;
  await ctx.conversation.send(
    `🎭 I received a reaction: ${reaction.content} (${reaction.action})`,
  );
});

// Handle received replies
agent.on("reply", async (ctx) => {
  const reply = ctx.message.content as Reply;
  await ctx.conversation.send(`💬 I received a reply: "${reply.content}"`);
});

agent.on("start", () => {
  console.log(`🚀 XMTP UX Demo Bot is running...`);
  console.log(`📍 Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗 ${getTestUrl(agent)}`);
  console.log(`\n📋 Supported Content Types:`);
  console.log(`   • Text Messages 📝`);
  console.log(`   • Reactions 👍`);
  console.log(`   • Replies 💬`);
  console.log(`\n💡 Send a message to get started!`);
});

void agent.start();
