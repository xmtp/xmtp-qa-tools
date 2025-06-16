import { createLogger } from "@helpers/logger";

const logger = createLogger();

export interface SlackChannelHistory {
  messages: any[];
  hasMore: boolean;
  responseMetadata?: any;
}

// Find channel ID by name
export async function findChannelByName(
  client: any,
  channelName: string,
): Promise<string | null> {
  logger.info(`🔍 Looking for channel: ${channelName}`);

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
    logger.info(`✅ Found channel ${channelName} with ID: ${channel.id}`);
    return channel.id as string;
  }

  logger.error(`❌ Channel ${channelName} not found`);
  return null;
}

// Fetch Slack channel history
export async function fetchChannelHistory(
  client: any,
  channelId: string,
  limit: number = 50,
  query?: string,
): Promise<SlackChannelHistory> {
  logger.info(`📜 Fetching channel history for ${channelId}, limit: ${limit}`);

  const result = await client.conversations.history({
    channel: channelId,
    limit: Math.min(limit, 100), // Slack API limit
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
    responseMetadata: result.response_metadata,
  };
}

// Format messages for display
export function formatMessagesForDisplay(
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

// List all available channels for debugging
export async function listAvailableChannels(client: any): Promise<string> {
  const result = await client.conversations.list({
    types: "public_channel,private_channel",
    limit: 1000,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${String(result.error)}`);
  }

  const channels = result.channels || [];
  const channelList = channels
    .filter(
      (ch: any) =>
        ch.name && typeof ch.name === "string" && typeof ch.id === "string",
    ) // Only channels with names
    .map((ch: any) => `• #${ch.name} (${ch.id})`)
    .sort()
    .slice(0, 20); // Limit to first 20 channels

  return `🔍 Available channels (showing first 20):\n${channelList.join("\n")}\n\nLooking for a specific channel? Let me know the exact name!`;
}
