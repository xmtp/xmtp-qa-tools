import fs from "fs";
import path from "path";
import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import type { SlackMessage } from "./slack-utils";

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
    const memberResult = await app.client.users.conversations({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    const channel = memberResult.channels?.find(
      (ch: any) => ch.name === testChannelName,
    );
    expect(channel?.id).toBeDefined();

    const historyResult = await app.client.conversations.history({
      channel: channel!.id!,
      limit: 1,
    });

    if (historyResult.messages?.length) {
      const latestMessage = historyResult.messages[0];
      expect(latestMessage.ts).toBeDefined();
    }
  }, 15000);

  it("should extract today's test failures", async () => {
    // Get channel
    const memberResult = await app.client.users.conversations({
      types: "public_channel,private_channel",
      limit: 1000,
    });
    const channel = memberResult.channels?.find(
      (ch: any) => ch.name === testChannelName,
    );
    const channelId = channel!.id!;

    // Fetch all messages with pagination
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      const result = await app.client.conversations.history({
        channel: channelId,
        limit: 200,
        cursor,
      });

      if (result.messages)
        allMessages.push(...(result.messages as unknown as SlackMessage[]));
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    // Extract today's test failures
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const testFailures = allMessages
      .filter((msg) => {
        const isToday =
          new Date(parseFloat(String(msg.ts || "0")) * 1000) >= startOfToday;
        return isToday && String(msg.text || "").includes("Test Failure :x:");
      })
      .map((msg) => {
        const text = String(msg.text || "");
        return {
          testName: extractBetween(
            text,
            "*Test:*",
            "github.com/xmtp/xmtp-qa-tools/actions/workflows/",
            ".yml",
          ),
          environment: extractField(text, "*Environment:*"),
          geolocation: extractField(text, "*Geolocation:*"),
          timestamp: extractField(text, "*Timestamp:*"),
          workflowUrl: extractUrl(text, "*Test log:*"),
          dashboardUrl: extractUrl(text, "*General dashboard:*"),
          customLinks: extractUrl(text, "*Agents tested:*"),
          errorLogs:
            text
              .match(/\*Logs:\*\s*```([^`]+)```/s)?.[1]
              ?.split("\n")
              .filter((l) => l.trim()) || [],
        };
      });

    // Save to file
    const data = {
      metadata: {
        channel: testChannelName,
        date: new Date().toISOString(),
        totalTestFailures: testFailures.length,
      },
      testFailures,
    };

    const filepath = path.join(__dirname, "issues.json");
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    // Verify
    expect(fs.existsSync(filepath)).toBe(true);
    expect(testFailures.length).toBeGreaterThanOrEqual(0);

    console.log(`✅ Extracted ${testFailures.length} test failures from today`);
  }, 30000);

  // Helper functions
  function extractField(text: string, label: string): string | null {
    const line = text.split("\n").find((l) => l.includes(label));
    return line?.split(label)[1]?.replace(/`/g, "").trim() || null;
  }

  function extractUrl(text: string, label: string): string | null {
    const line = text.split("\n").find((l) => l.includes(label));
    return line?.match(/<([^|>]+)/)?.[1] || null;
  }

  function extractBetween(
    text: string,
    label: string,
    start: string,
    end: string,
  ): string | null {
    const field = extractField(text, label);
    if (!field) return null;
    const startIdx = field.indexOf(start);
    if (startIdx === -1) return null;
    const after = field.substring(startIdx + start.length);
    const endIdx = after.indexOf(end);
    return endIdx === -1 ? null : after.substring(0, endIdx);
  }
});
