# Agents monitoring

## Automated workflows

| Test suite | Status                                                                                                                                                                   | Resources                                                                                                                                                          | Run frequency | Networks           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------ |
| Agents     | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)       | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents)    | Every 30 min  | `dev` `production` |
| AgentText  | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents) | Every 4 hours | `dev` `production` |

**Purpose**: Validates health, responsiveness, and behavioral patterns of live XMTP agents across production and development environments.

### Core tests:

- `agents-dms: dm first reaction`
- `agents-text: first meaningful response`
- `agents-tagged: group chat message and slash command response`
- `agents-untagged: negative testing ensuring proper filtering`

**Measurements**:

- Agent response time in milliseconds
- Success/failure rate per agent
- Behavioral compliance (respond/don't respond as configured)

## 1. Direct message testing

Link to test code [../monitoring/agents/agents-dms.test.ts](../monitoring/agents/agents-dms.test.ts)

### Test flow:

1. Create DM conversation with agent using Ethereum address
2. Send agent's configured `sendMessage`
3. agent responds within timeout period

## 1. First reaction response

Link to test code [../monitoring/agents/agents-dms.test.ts](../monitoring/agents/agents-dms.test.ts)

### Test flow:

1. Create DM conversation with agent using Ethereum address
2. Send agent's configured `sendMessage`
3. agent responds within timeout period

## 2. Meaningful response testing

Link to test code [../monitoring/agents/agents-tagged.test.ts](../monitoring/agents/agents-tagged.test.ts)

### Test flow:

1. Create group conversation with agent and random participant
2. Send tagged message or slash command:
   - Slash commands: sent as-is (e.g., `/help`)
   - Regular messages: prefixed with agent tag (e.g., `@agent.base.eth message`)
3. agent responds within timeout

### Agent filtering:

- Only tests agents where `respondOnTagged: true`
- Filters by network environment (`dev` or `production`)

## 3. Negative testing

Link to test code [../monitoring/agents/agents-untagged.test.ts](../monitoring/agents/agents-untagged.test.ts)

### Test flow:

1. Create group conversation with agent and random participant
2. Send initial "hi" message (ignore welcome response)
3. Send second "hi" message
4. agent does NOT respond

**Expected behavior**: Agents should NOT respond to generic "hi" messages to prevent spam.

## Agent configuration

### Properties:

- **name**: Agent identifier
- **address**: Ethereum address
- **sendMessage**: Test message to send
- **networks**: Supported networks (`["dev", "production"]`)
- **respondOnTagged**: Whether agent responds to tagged messages
- **live**: Production status flag

### Example (gm bot):

```json
{
  "name": "gm",
  "baseName": "gm.base.eth",
  "address": "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "sendMessage": "hola",
  "live": false,
  "networks": ["dev", "production"],
  "slackChannel": "#gm-alerts",
  "respondOnTagged": false
}
```

See agents [configuration](agents.json)
