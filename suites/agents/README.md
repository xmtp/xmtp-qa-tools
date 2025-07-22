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

## Concurrency testing

### Concurrent messages on production

| Metric              |   local    |     gm     |   bankr    |
| ------------------- | :--------: | :--------: | :--------: |
| Environment         |   local    |  railway   |  railway   |
| Timeout             |    120s    |    120s    |    120s    |
| Network             | production | production | production |
| Total Messages      |    500     |    500     |    500     |
| Messages per Second |    100     |    100     |    100     |
| Success Rate        |    100%    |  99.8% ✅  |  58.8% ❌  |
| Total Time          |   366.7s   |   636.0s   |   121.6s   |
| Avg Response        | 16.78s ⚠️  | 21.60s ⚠️  | 74.38s ❌  |
| Median Response     |   1.19s    |   14.32s   |   76.62s   |
| 95th Percentile     |   57.44s   |   57.81s   |  113.05s   |

> This measurments were taking over 10 runs of 500 parallel messages each totaling 5000 messages.

### First run comparison

| Metric                        | First Run         | Second Run        |
| ----------------------------- | ----------------- | ----------------- |
| Success Rate                  | 237/500 (47.4%)   | 500/500 (100.0%)  |
| Total Execution Time          | 122.0s            | 5.0s              |
| Average Response Time         | 55.53s            | 1.92s             |
| Median Response Time          | 56.72s            | 2.16s             |
| 95th Percentile Response Time | 107.88s           | 2.65s             |
| Messages per Second           | 4.1               | 100.3             |
| Threshold Status              | ❌ FAILURE (<99%) | ✅ SUCCESS (≥99%) |
