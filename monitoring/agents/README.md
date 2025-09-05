# Agents monitoring

## Automated workflows

| Test suite  | Status                                                                                                                                                                       | Resources                                                                                                                                                            | Run frequency | Networks           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Agents      | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)           | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents)      | Every 30 min  | `dev` `production` |
| AgentHealth | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents) | Every 4 hours | `dev` `production` |

**Purpose**: Validates health, responsiveness, and behavioral patterns of live XMTP agents across production and development environments.

### Core tests:

- `agents-dms: direct message responsiveness validation`
- `agents-tagged: tagged message and slash command response verification`
- `agents-untagged: negative testing ensuring proper message filtering`

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

### Live agents:

- **tbachat**: `/help` command testing
- **elsa**: "hi" message testing
- **key-check**: "/kc help" command testing

## 2. Tagged message testing

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

## 3. Untagged message testing

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

### Agent uptime SLOs

Individual agent uptime performance tracking over 7-day periods.

| Agent Name | Target | Status   | Error Budget Left | Tags                   |
| ---------- | ------ | -------- | ----------------- | ---------------------- |
| Bitte      | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Mamo       | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Flaunchy   | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Elsa       | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Byte       | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Arma       | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Bankr      | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Onit       | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Squabble   | 99%    | 100.000% | 100%              | qa-agents, reliability |
| Clanker    | 99%    | 100.000% | 100%              | qa-agents, reliability |

_Note: All agent uptime SLOs are performing optimally with 100% uptime and full error budget remaining._

### Agent response time SLOs

Individual agent response time performance tracking over 7-day periods.

| Agent Name | Target | Status   | Error Budget Left | Tags      |
| ---------- | ------ | -------- | ----------------- | --------- |
| Byte       | 99%    | 100.000% | 100%              | performan |
| Squabble   | 99%    | 99.950%  | 95%               | performan |
| Arma       | 99%    | 99.900%  | 90%               | performan |
| Bitte      | 99%    | 99.751%  | 75%               | performan |
| Onit       | 99%    | 99.503%  | 50%               | performan |
| Elsa       | 99%    | 99.355%  | 36%               | performan |
| Bankr      | 99%    | 94.097%  | -490%             | performan |
| Mamo       | 99%    | 91.617%  | -738%             | performan |
| Clanker    | 99%    | 77.083%  | -2192%            | performan |
| Flaunchy   | 99%    | 64.682%  | -3432%            | performan |

_Note: Top 6 agents are meeting or close to target, while bottom 4 agents show significant performance degradation with negative error budgets._
