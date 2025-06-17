import fs from "fs";
import path from "path";
import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

dotenv.config();

describe("Slack Bolt Integration Test", () => {
  let app: App;
  const testChannelName = process.env.SLACK_CHANNEL;

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

  it("should retrieve and save all messages from today", async () => {
    console.log(
      `🔍 Fetching all messages from today in channel: ${testChannelName}`,
    );

    // Get channel ID first
    const memberResult = await app.client.users.conversations({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    expect(memberResult.ok).toBe(true);
    const channel = memberResult.channels?.find(
      (ch: any) => ch.name === testChannelName,
    );

    expect(channel).toBeDefined();
    const channelId = channel!.id!;
    console.log(`✅ Found channel ${testChannelName} with ID: ${channelId}`);

    // Calculate today's timestamp range
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const oldestTimestamp = Math.floor(startOfDay.getTime() / 1000).toString();
    const latestTimestamp = Math.floor(endOfDay.getTime() / 1000).toString();

    console.log(
      `📅 Fetching messages from ${startOfDay.toLocaleString()} to ${endOfDay.toLocaleString()}`,
    );

    // Fetch messages with pagination
    let allMessages: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const historyResult = await app.client.conversations.history({
        channel: channelId,
        oldest: oldestTimestamp,
        latest: latestTimestamp,
        limit: 200, // Maximum allowed per request
        cursor: cursor,
      });

      expect(historyResult.ok).toBe(true);

      if (historyResult.messages) {
        allMessages.push(...historyResult.messages);
        console.log(
          `📥 Fetched ${historyResult.messages.length} messages (total: ${allMessages.length})`,
        );
      }

      // Check if there are more messages
      if (
        historyResult.has_more &&
        historyResult.response_metadata?.next_cursor
      ) {
        cursor = historyResult.response_metadata.next_cursor;
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Total messages found for today: ${allMessages.length}`);

    // Parse messages
    const parsedMessages = allMessages.map((message: any) => {
      const timestamp = new Date(parseFloat(message.ts || "0") * 1000);
      return {
        id: message.ts,
        timestamp: timestamp.toISOString(),
        timestampLocal: timestamp.toLocaleString(),
        user: message.user || "Unknown",
        text: message.text || "[No text]",
        type: message.type || "message",
        subtype: message.subtype || null,
        hasAttachments: Boolean(message.files && message.files.length > 0),
        threadTs: message.thread_ts || null,
        isBot: Boolean(message.bot_id),
        reactions: message.reactions || [],
      };
    });

    // Sort messages by timestamp (oldest first)
    parsedMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Create filename with today's date
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `slack-messages-${testChannelName}-${dateStr}.json`;
    const filepath = path.join(__dirname, filename);

    // Save to file
    const dataToSave = {
      metadata: {
        channel: testChannelName,
        channelId: channelId,
        date: dateStr,
        fetchedAt: new Date().toISOString(),
        totalMessages: parsedMessages.length,
        dateRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString(),
        },
      },
      messages: parsedMessages,
    };

    fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));
    console.log(`💾 Saved ${parsedMessages.length} messages to: ${filepath}`);

    // Verify file was created
    expect(fs.existsSync(filepath)).toBe(true);
    const fileContent = JSON.parse(fs.readFileSync(filepath, "utf8"));
    expect(fileContent.messages).toHaveLength(parsedMessages.length);
    expect(fileContent.metadata.totalMessages).toBe(parsedMessages.length);

    // Log some statistics
    const userMessages = parsedMessages.filter((m) => !m.isBot);
    const botMessages = parsedMessages.filter((m) => m.isBot);
    const threadsCount = parsedMessages.filter((m) => m.threadTs).length;

    console.log(`📈 Statistics:`);
    console.log(`   👥 User messages: ${userMessages.length}`);
    console.log(`   🤖 Bot messages: ${botMessages.length}`);
    console.log(`   🧵 Thread messages: ${threadsCount}`);
    console.log(
      `   📎 Messages with attachments: ${parsedMessages.filter((m) => m.hasAttachments).length}`,
    );

    console.log("🎉 Messages retrieved and saved successfully!");
  }, 30000); // Increased timeout for potentially large message sets
});
