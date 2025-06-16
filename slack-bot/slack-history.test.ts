import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Slack API response interfaces
interface MockSlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
}

interface MockSlackMessage {
  text: string;
  user: string;
  ts: string;
  type: string;
}

interface MockSlackAPIResponse {
  ok: boolean;
  channels?: MockSlackChannel[];
  messages?: MockSlackMessage[];
  error?: string;
  has_more?: boolean;
}

// Mock Slack client
class MockSlackClient {
  private mockChannels: MockSlackChannel[] = [
    {
      id: "C1234567890",
      name: "notify-qa-tools",
      is_channel: true,
      is_private: false,
    },
    { id: "C0987654321", name: "general", is_channel: true, is_private: false },
  ];

  private mockMessages: MockSlackMessage[] = [
    {
      text: 'Test Failure :x:\nTest: Browser\nEnvironment: dev\nGeneral dashboard: View\nGeolocation: us-east\nTimestamp: 6/16/2025, 7:50:23 PM\nTest log: View url\nLogs:\nxmtp_mls::groups::key_package_cleaner_worker: sync worker error storage error: Record not found inbox_id="cac4503efa29c6a8bc93fbc059d05730c9b103b855665752aa948baa471c3874" installation_id="3fa96b6d3a9a6d15cb016fa80a5922f8082912c8a18187d1e1134feae36d5ba8"\nprocess:sync_welcomes: xmtp_mls::groups::welcome_sync: failed to create group from welcome: welcome with cursor [99185823] already processed',
      user: "U123456789",
      ts: "1718573423.123456",
      type: "message",
    },
    {
      text: "Another test message",
      user: "U987654321",
      ts: "1718573420.123456",
      type: "message",
    },
  ];

  conversations = {
    list: vi.fn().mockResolvedValue({
      ok: true,
      channels: this.mockChannels,
    } as MockSlackAPIResponse),

    history: vi.fn().mockResolvedValue({
      ok: true,
      messages: this.mockMessages,
      has_more: false,
    } as MockSlackAPIResponse),

    info: vi.fn().mockResolvedValue({
      ok: true,
      channel: { is_im: false },
    }),
  };

  chat = {
    update: vi.fn().mockResolvedValue({ ok: true, ts: "1234567890.123456" }),
  };
}

// Extract the core functions we want to test
async function findChannelByName(
  client: any,
  channelName: string,
): Promise<string | null> {
  try {
    const result = await client.conversations.list({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    if (!result.ok) {
      throw new Error(`Slack API error: ${String(result.error)}`);
    }

    const channel = result.channels?.find(
      (ch: any) =>
        ch.name === channelName || ch.name === channelName.replace("#", ""),
    );

    if (channel && typeof channel.id === "string") {
      return channel.id;
    }

    return null;
  } catch (error) {
    throw error;
  }
}

async function fetchChannelHistory(
  client: any,
  channelId: string,
  limit: number = 50,
  query?: string,
): Promise<{ messages: any[]; hasMore: boolean }> {
  try {
    const result = await client.conversations.history({
      channel: channelId,
      limit: Math.min(limit, 100),
      inclusive: true,
    });

    if (!result.ok) {
      throw new Error(`Slack API error: ${String(result.error)}`);
    }

    let messages = result.messages || [];

    // Filter messages if query is provided
    if (query) {
      const searchTerm = query.toLowerCase();
      messages = messages.filter(
        (msg: any) =>
          msg.text &&
          typeof msg.text === "string" &&
          msg.text.toLowerCase().includes(searchTerm),
      );
    }

    return {
      messages,
      hasMore: Boolean(result.has_more),
    };
  } catch (error) {
    throw error;
  }
}

function formatMessagesForDisplay(
  messages: any[],
  maxMessages: number = 10,
): string {
  if (messages.length === 0) {
    return "No messages found matching your criteria.";
  }

  const sortedMessages = messages
    .slice(0, maxMessages)
    .sort(
      (a: any, b: any) =>
        parseFloat(b.ts as string) - parseFloat(a.ts as string),
    );

  let formatted = `📋 Found ${messages.length} message(s):\n\n`;

  for (const msg of sortedMessages) {
    const timestamp = new Date(
      parseFloat(msg.ts as string) * 1000,
    ).toLocaleString();
    const user = msg.user ? `<@${msg.user}>` : "Unknown User";
    const text = msg.text ? msg.text.substring(0, 200) : "[No text]";

    formatted += `🕒 ${timestamp}\n`;
    formatted += `👤 ${user}\n`;
    formatted += `💬 ${text}\n`;
    if (text.length === 200 && msg.text && msg.text.length > 200) {
      formatted += `... (truncated)\n`;
    }
    formatted += `\n`;
  }

  if (messages.length > maxMessages) {
    formatted += `\n... and ${messages.length - maxMessages} more messages`;
  }

  return formatted;
}

describe("Slack History Integration Tests", () => {
  let mockClient: MockSlackClient;

  beforeEach(() => {
    mockClient = new MockSlackClient();
  });

  describe("findChannelByName", () => {
    it("should find a channel by exact name", async () => {
      const channelId = await findChannelByName(mockClient, "notify-qa-tools");

      expect(channelId).toBe("C1234567890");
      expect(mockClient.conversations.list).toHaveBeenCalledWith({
        types: "public_channel,private_channel",
        limit: 1000,
      });
    });

    it("should find a channel when name starts with #", async () => {
      const channelId = await findChannelByName(mockClient, "#notify-qa-tools");

      expect(channelId).toBe("C1234567890");
    });

    it("should return null when channel is not found", async () => {
      const channelId = await findChannelByName(
        mockClient,
        "non-existent-channel",
      );

      expect(channelId).toBe(null);
    });

    it("should handle Slack API errors", async () => {
      mockClient.conversations.list = vi.fn().mockResolvedValue({
        ok: false,
        error: "channel_not_found",
      });

      await expect(findChannelByName(mockClient, "test")).rejects.toThrow(
        "Slack API error: channel_not_found",
      );
    });
  });

  describe("fetchChannelHistory", () => {
    it("should fetch channel history successfully", async () => {
      const history = await fetchChannelHistory(mockClient, "C1234567890", 50);

      expect(history.messages).toHaveLength(2);
      expect(history.hasMore).toBe(false);
      expect(mockClient.conversations.history).toHaveBeenCalledWith({
        channel: "C1234567890",
        limit: 50,
        inclusive: true,
      });
    });

    it("should filter messages by query", async () => {
      const history = await fetchChannelHistory(
        mockClient,
        "C1234567890",
        50,
        "test failure",
      );

      expect(history.messages).toHaveLength(1);
      expect(history.messages[0].text).toContain("Test Failure");
    });

    it("should handle API limit correctly", async () => {
      await fetchChannelHistory(mockClient, "C1234567890", 150);

      expect(mockClient.conversations.history).toHaveBeenCalledWith({
        channel: "C1234567890",
        limit: 100, // Should be capped at 100
        inclusive: true,
      });
    });

    it("should handle Slack API errors", async () => {
      mockClient.conversations.history = vi.fn().mockResolvedValue({
        ok: false,
        error: "channel_not_found",
      });

      await expect(
        fetchChannelHistory(mockClient, "invalid", 50),
      ).rejects.toThrow("Slack API error: channel_not_found");
    });
  });

  describe("formatMessagesForDisplay", () => {
    it("should format messages correctly", async () => {
      const history = await fetchChannelHistory(mockClient, "C1234567890", 50);
      const formatted = formatMessagesForDisplay(history.messages);

      expect(formatted).toContain("📋 Found 2 message(s):");
      expect(formatted).toContain("Test Failure :x:");
      expect(formatted).toContain("<@U123456789>");
      expect(formatted).toContain("Another test message");
    });

    it("should handle empty messages", () => {
      const formatted = formatMessagesForDisplay([]);

      expect(formatted).toBe("No messages found matching your criteria.");
    });

    it("should truncate long messages", async () => {
      const history = await fetchChannelHistory(mockClient, "C1234567890", 50);
      const formatted = formatMessagesForDisplay(history.messages);

      // The first message is longer than 200 chars, so should be truncated
      expect(formatted).toContain("... (truncated)");
    });

    it("should limit number of messages displayed", async () => {
      const history = await fetchChannelHistory(mockClient, "C1234567890", 50);
      const formatted = formatMessagesForDisplay(history.messages, 1);

      expect(formatted).toContain("... and 1 more messages");
    });
  });

  describe("Full Integration Test", () => {
    it("should complete the full history fetch workflow", async () => {
      // Step 1: Find the channel
      const channelId = await findChannelByName(mockClient, "notify-qa-tools");
      expect(channelId).toBe("C1234567890");

      // Step 2: Fetch history
      const history = await fetchChannelHistory(mockClient, channelId!, 50);
      expect(history.messages).toHaveLength(2);

      // Step 3: Format for display
      const formatted = formatMessagesForDisplay(history.messages);
      expect(formatted).toContain("Test Failure :x:");
      expect(formatted).toContain(
        "xmtp_mls::groups::key_package_cleaner_worker",
      );

      console.log("✅ Full integration test passed!");
      console.log("📋 Formatted output preview:");
      console.log(formatted.substring(0, 300) + "...");
    });

    it("should handle the specific test failure message correctly", async () => {
      const history = await fetchChannelHistory(
        mockClient,
        "C1234567890",
        50,
        "xmtp_mls",
      );

      expect(history.messages).toHaveLength(1);
      const message = history.messages[0];

      expect(message.text).toContain("Test Failure :x:");
      expect(message.text).toContain("Environment: dev");
      expect(message.text).toContain(
        "xmtp_mls::groups::key_package_cleaner_worker",
      );
      expect(message.text).toContain("Record not found inbox_id");
      expect(message.text).toContain(
        "welcome with cursor [99185823] already processed",
      );

      console.log("✅ Test failure message parsing works correctly!");
    });
  });
});
