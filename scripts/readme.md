# 📜 Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick reference

| Script          | Purpose                     | Key Features                         |
| --------------- | --------------------------- | ------------------------------------ |
| **cli.ts**      | General-purpose task runner | Configurable operations              |
| **versions.ts** | Manages SDK versions        | XMTP SDK version management/symlinks |

## Usage

You can run these scripts using the yarn commands defined in package.json:

```bash
# Generate XMTP keys
yarn gen:keys
# Run a specific script without the extension
yarn script <script-name>
# Run a bot with arguments
yarn bot <bot-name> [args]
```

# Slack Bot for XMTP QA Tools

A Slack bot that integrates with Anthropic's Claude SDK for AI responses and provides utilities for fetching Slack channel history and DataDog logs.

## Features

### AI Chat with Claude

- Direct message support
- @mention support in channels
- Powered by Anthropic's Claude SDK (replacing Claude Code)

### 📋 Channel History

- Fetch recent messages from any channel
- Search through message history
- Configurable message limits

### 📊 DataDog Integration

- Send logs to DataDog
- Track bot interactions
- Monitor test results

## Available Commands

### `/history [limit] [search_query]`

Fetch channel message history with optional filtering.

**Examples:**

- `/history 20` - Get last 20 messages
- `/history 10 xmtp` - Get last 10 messages containing "xmtp"
- `/history 50 error` - Get last 50 messages containing "error"

### `/logs [test_name]`

Send a log entry to DataDog for tracking.

**Examples:**

- `/logs integration-test` - Send DataDog log for integration-test
- `/logs performance-check` - Send DataDog log for performance-check

### `/help`

Show available commands and usage examples.

## Environment Variables

Required environment variables:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
ANTHROPIC_API_KEY=your-anthropic-api-key
DATADOG_API_KEY=your-datadog-api-key # Optional, for DataDog integration
XMTP_ENV=dev # Optional, defaults to 'dev'
GEOLOCATION=us-east # Optional, for DataDog region tracking
```

## Usage

### Running the Bot

```bash
# Install dependencies
yarn install

# Set up environment variables in .env file
cp .env.example .env
# Edit .env with your tokens
```

### Interacting with the Bot

1. **Direct Messages**: Send any message directly to the bot
2. **Channel Mentions**: Mention the bot with `@bot-name your message`
3. **Commands**: Use slash commands like `/history 10` or `/logs test-name`

## Features in Detail

### Channel History Fetching

- Fetches up to 100 messages per request (Slack API limit)
- Automatically formats timestamps and user mentions
- Supports text search across message content
- Truncates long messages for readability

### DataDog Integration

- Uses existing DataDog helper functions from `@helpers/datadog`
- Tracks bot commands and interactions
- Includes metadata like test names, regions, and timestamps
- Integrates with existing XMTP QA monitoring infrastructure

### Error Handling

- Comprehensive error logging
- Graceful degradation for API failures
- User-friendly error messages
- Automatic retry mechanisms where appropriate

## Development

### File Structure

- `helpers/datadog.ts` - DataDog integration utilities
- `helpers/logger.ts` - Logging utilities

### Key Functions

- `processMessage()` - Main message processing pipeline
- `fetchChannelHistory()` - Slack history retrieval
- `handleDataDogLogsCommand()` - DataDog log management
- `processWithAnthropic()` - Claude AI integration

## Deployment

The bot can be deployed to any Node.js environment with access to:

- Slack Bot API
- Anthropic API
- DataDog API (optional)

Make sure to configure the required environment variables and ensure the bot has appropriate Slack permissions for reading channel history and posting messages.
