#!/usr/bin/env tsx

/**
 * Slack Bot Verification Script
 *
 * This script tests the actual Slack bot's ability to fetch channel history
 * using real Slack API credentials (if available).
 */
import pkg from "@slack/bolt";
import dotenv from "dotenv";

const { App } = pkg;

dotenv.config();

async function verifySlackBotIntegration() {
  console.log("🤖 Verifying Slack Bot Integration...");
  console.log("=====================================");

  // Check environment variables
  const requiredEnvVars = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    console.log("⚠️  Missing environment variables:", missingVars.join(", "));
    console.log("This verification requires real Slack credentials.");
    console.log("Skipping live API tests...");
    return;
  }

  console.log("✅ Environment variables found");

  try {
    // Initialize Slack app
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: false, // Use HTTP mode for testing
    });

    console.log("✅ Slack app initialized");

    // Test 1: List channels
    console.log("\n🔍 Test 1: Listing channels...");
    const channelResult = await app.client.conversations.list({
      types: "public_channel,private_channel",
      limit: 10,
    });

    if (channelResult.ok && channelResult.channels) {
      console.log(`✅ Found ${channelResult.channels.length} channels`);

      // Look for notify-qa-tools channel
      const targetChannel = channelResult.channels.find(
        (ch: any) => ch.name === "notify-qa-tools",
      );

      if (targetChannel) {
        console.log(
          `✅ Found target channel: #notify-qa-tools (${targetChannel.id})`,
        );

        // Test 2: Fetch channel history
        console.log("\n📜 Test 2: Fetching channel history...");
        const historyResult = await app.client.conversations.history({
          channel: targetChannel.id,
          limit: 5,
        });

        if (historyResult.ok && historyResult.messages) {
          console.log(
            `✅ Successfully fetched ${historyResult.messages.length} messages`,
          );

          // Show preview of latest message
          if (historyResult.messages.length > 0) {
            const latestMessage = historyResult.messages[0];
            const preview = latestMessage.text
              ? latestMessage.text.substring(0, 100) + "..."
              : "[No text content]";

            console.log(`📋 Latest message preview: ${preview}`);

            // Check if it matches the expected test failure format
            if (
              latestMessage.text &&
              latestMessage.text.includes("Test Failure")
            ) {
              console.log("✅ Found test failure message format!");
            }
          }
        } else {
          console.log(`❌ Failed to fetch history: ${historyResult.error}`);
        }
      } else {
        console.log(
          "⚠️  Channel #notify-qa-tools not found or bot not invited",
        );
        console.log(
          "Available channels:",
          channelResult.channels
            .map((ch: any) => ch.name)
            .slice(0, 5)
            .join(", "),
        );
      }
    } else {
      console.log(`❌ Failed to list channels: ${channelResult.error}`);
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
  }

  console.log("\n🏁 Verification complete!");
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifySlackBotIntegration().catch(console.error);
}

export { verifySlackBotIntegration };
