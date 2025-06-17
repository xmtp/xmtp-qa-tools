import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

dotenv.config();

describe("Slack Bolt Integration Test", () => {
  let app: App;
  const testChannelName = "notify-qa-tools";

  beforeAll(() => {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN environment variable is required");
    }

    app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET || "dummy-secret",
    });
  });

  it("should fetch channel ID and latest message", async () => {
    console.log(`🔍 Looking for channel: ${testChannelName}`);

    // Use users.conversations to get channels the bot is a member of
    // This is more reliable than conversations.list for private channels
    const memberResult = await app.client.users.conversations({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    expect(memberResult.ok).toBe(true);
    expect(memberResult.channels).toBeDefined();

    const channel = memberResult.channels?.find(
      (ch: any) => ch.name === testChannelName,
    );

    expect(channel).toBeDefined();
    expect(channel?.id).toBeDefined();

    const channelId = channel!.id!;
    console.log(`✅ Found channel ${testChannelName} with ID: ${channelId}`);

    // Fetch the latest message
    const historyResult = await app.client.conversations.history({
      channel: channelId,
      limit: 1,
    });

    expect(historyResult.ok).toBe(true);
    expect(historyResult.messages).toBeDefined();

    if (historyResult.messages && historyResult.messages.length > 0) {
      const latestMessage = historyResult.messages[0];
      const timestamp = new Date(
        parseFloat(latestMessage.ts!) * 1000,
      ).toLocaleString();

      console.log("📨 Latest message:");
      console.log(`🕒 Timestamp: ${timestamp}`);
      console.log(`👤 User: ${latestMessage.user || "Unknown"}`);
      console.log(`💬 Text: ${latestMessage.text || "[No text]"}`);

      expect(latestMessage.ts).toBeDefined();
    } else {
      console.log("📭 No messages found in channel");
    }

    console.log("🎉 Test completed successfully!");
  }, 15000);
});
