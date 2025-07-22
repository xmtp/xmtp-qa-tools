# Agents monitoring

## Automated workflows

| Test suite | Performance                                                                                                                                                        | Resources                                                                                                                                                   | Run frequency | Networks           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Agents     | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/agents) | Every 15 min  | `dev` `production` |

**Purpose**: Validates health, responsiveness, and behavioral patterns of live XMTP agents across production and development environments.

### Core tests:

- `agents-dms: direct message responsiveness validation`
- `agents-tagged: tagged message and slash command response verification`
- `agents-untagged: negative testing ensuring proper message filtering`

**Measurements**:

- Agent response time in milliseconds
- Success/failure rate per agent
- Behavioral compliance (respond/don't respond as configured)

---

## 1. Direct message testing [../suites/agents/agents-dms.test.ts](../suites/agents/agents-dms.test.ts)

### Test flow:

1. Create DM conversation with agent using Ethereum address
2. Send agent's configured `sendMessage`
3. Verify agent responds within timeout period

### Agent examples:

- **tbachat**: `/help` command testing
- **elsa**: "hi" message testing
- **key-check**: "/kc help" command testing

---

## 2. Tagged message testing [../suites/agents/agents-tagged.test.ts](../suites/agents/agents-tagged.test.ts)

### Test flow:

1. Create group conversation with agent and random participant
2. Send tagged message or slash command:
   - Slash commands: sent as-is (e.g., `/help`)
   - Regular messages: prefixed with agent tag (e.g., `@agent.base.eth message`)
3. Verify agent responds within timeout

### Agent filtering:

- Only tests agents where `respondOnTagged: true`
- Filters by network environment (`dev` or `production`)

---

## 3. Untagged message testing [../suites/agents/agents-untagged.test.ts](../suites/agents/agents-untagged.test.ts)

### Test flow:

1. Create group conversation with agent and random participant
2. Send initial "hi" message (ignore welcome response)
3. Send second "hi" message
4. Verify agent does NOT respond

**Expected behavior**: Agents should NOT respond to generic "hi" messages to prevent spam.

---

## Agent configuration

### Properties:

- **name**: Agent identifier
- **address**: Ethereum address
- **sendMessage**: Test message to send
- **networks**: Supported networks (`["dev", "production"]`)
- **respondOnTagged**: Whether agent responds to tagged messages
- **live**: Production status flag

- See agents [configuration](../suites/agents/agents.json)
