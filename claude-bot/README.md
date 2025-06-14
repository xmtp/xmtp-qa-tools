# Claude Slack Bot

A simple CLI tool that sends messages to Claude Code and posts the responses to Slack channels.

## Setup

1. **Get your Slack Bot Token**:

   - Go to https://api.slack.com/apps
   - Create a new app or select an existing one
   - Go to "OAuth & Permissions"
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

2. **Set up environment variables**:

   ```bash
   cp env.template .env
   # Edit .env and add your SLACK_BOT_TOKEN
   ```

3. **Install dependencies**:
   ```bash
   yarn install
   ```

## Usage

Send a message to Claude Code and post the response to a Slack channel:

```bash
# Basic usage
yarn dev '#general' 'create a simple hello world script'

# Reply to a specific thread
yarn dev '#general' 'fix the bug in index.ts' '1234567890.123456'
```

### Arguments

- `<channel>`: Slack channel name (e.g., `#general`) or channel ID
- `<message>`: The message to send to Claude Code
- `[thread_ts]`: Optional - timestamp of the thread to reply to

## Required Permissions

Your Slack bot needs the following OAuth scopes:

- `chat:write` - To post messages
- `channels:read` - To access channel information

## Examples

```bash
# Ask Claude to create a new script
yarn dev '#dev-team' 'create a TypeScript function that validates email addresses'

# Ask Claude to debug code
yarn dev '#general' 'review this function and suggest improvements: function add(a, b) { return a + b; }'

# Reply in a thread
yarn dev '#general' 'explain how this works' '1703123456.789123'
```

## Environment Variables

- `SLACK_BOT_TOKEN` - Required. Your Slack bot token (starts with `xoxb-`)
- `XMTP_REPO_PATH` - Optional. Path to your XMTP repository (defaults to current directory)
