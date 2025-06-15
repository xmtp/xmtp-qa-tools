# QA Agent - Slack Bot

A Slack bot that integrates with Claude CLI for answering questions.

## Railway Deployment

### 1. Deploy to Railway

```bash
# From the qa-agent directory
railway deploy
```

### 2. Set Environment Variables

In Railway dashboard, set these environment variables:

- `SLACK_BOT_TOKEN`: Your Slack bot token (starts with `xoxb-`)
- `SLACK_APP_TOKEN`: Your Slack app token (starts with `xapp-`)

### 3. Install Claude CLI on Railway

The bot requires the `claude` CLI to be available. Add this to your Railway deployment:

**Option A: Add to nixpacks.toml**

```toml
[phases.setup]
nixPkgs = ["nodejs", "python3"]
cmds = ["npm install -g @anthropic-ai/claude-code"]
```

**Option B: Add to package.json**

```json
{
  "scripts": {
    "postinstall": "npm install -g @anthropic-ai/claude-code"
  }
}
```

### 4. Configure Volume Mount (Optional)

For persistent data, configure a volume mount in Railway and set:

- `RAILWAY_VOLUME_MOUNT_PATH`: Path to your mounted volume

## Local Development

```bash
npm install
npm run dev
```

Make sure you have:

1. Claude CLI installed: `npm install -g @anthropic-ai/claude-code`
2. Environment variables set in `.env` file

## Features

- Responds to @mentions in channels
- Responds to direct messages
- Responds to `/qa` slash command
- Integrates with Claude CLI for intelligent responses
