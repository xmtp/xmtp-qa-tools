# Slack Claude Bot

A Slack bot that relays messages to Claude Code running in your XMTP QA Tools repository.

## Setup

### 1. Install Dependencies

```bash
cd slack-claude-bot
yarn install
```

### 2. Create Slack App

1. Go to https://api.slack.com/apps
2. Create a new app "From an app manifest"
3. Use this manifest:

```json
{
  "display_information": {
    "name": "Claude Bot"
  },
  "features": {
    "bot_user": {
      "display_name": "Claude Bot",
      "always_online": false
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "chat:write",
        "reactions:read",
        "reactions:write"
      ]
    }
  },
  "event_subscriptions": {
    "bot_events": ["app_mention"]
  },
  "socket_mode_enabled": true
}
```

### 3. Configure Environment Variables

Create a `.env` file with:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
XMTP_REPO_PATH=/Users/fabrizioguespe/DevRel/xmtp-qa-tools
```

Get these values from your Slack app settings:

- **Bot Token**: OAuth & Permissions → Bot User OAuth Token
- **Signing Secret**: Basic Information → Signing Secret
- **App Token**: Basic Information → App-Level Tokens (create with `connections:write` scope)

### 4. Install Bot to Workspace

1. Go to OAuth & Permissions
2. Click "Install to Workspace"
3. Authorize the app

### 5. Run the Bot

```bash
yarn dev
```

## Usage

1. Invite the bot to a Slack channel: `/invite @Claude Bot`
2. Mention the bot with your message: `@Claude Bot run yarn test`
3. The bot will:
   - Add a 🤔 reaction
   - Send your message to Claude Code in the XMTP repo
   - Reply with Claude's response in a thread
   - Remove the 🤔 reaction

## How It Works

```
Slack Message → Slack Bot → Claude Code → XMTP Repo (.claude/context.md) → Response → Slack
```

The bot spawns `claude "your message"` in your XMTP repo directory, which means Claude Code will:

- Read your `.claude/context.md` file (with yarn-only constraint)
- Have access to your XMTP testing framework
- Only run yarn commands as specified in your context
- Return results back to Slack
