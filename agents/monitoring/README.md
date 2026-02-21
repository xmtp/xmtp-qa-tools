# Agents monitoring

| Test suite   | Status                                                                                                                                                                       | Resources                                                                                                                                                            | Run frequency    | Networks           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ |
| AgentGroups  | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml)  | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/agents/monitoring) | Every 30 min     | `dev` `production` |
| AgentHealth  | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/agents/monitoring) | Every 10 minutes | `dev` `production` |

**Purpose**: Validates health, responsiveness, and behavioral patterns of live XMTP agents across production and development environments.

## Core tests

| Suite              | File                     | Description |
| ------------------ | ------------------------ | ----------- |
| `agents-dms`       | [agents-dms.test.ts](./agents-dms.test.ts)       | DM first reaction: agent responds in DM within timeout. |
| `agents-tagged`    | [agents-tagged.test.ts](./agents-tagged.test.ts) | Group: agent responds to tagged/command message in group. |
| `agents-untagged`  | [agents-untagged.test.ts](./agents-untagged.test.ts) | Negative: agent does not respond to untagged "hi" in group. |
| `agents-stress`    | [agents-stress.test.ts](./agents-stress.test.ts) | Stress: 50 groups, 10 messages each (agents with `live: false` only). |

**Measurements**

- Agent response time (ms), success/failure, behavioral compliance (respond or not as expected).

## 1. DM first reaction (`agents-dms`)

- Create DM with agent by Ethereum address.
- Send `customText` or default ping message.
- Assert agent responds within timeout; report response time to Datadog.

## 2. Group tagged/command (`agents-tagged`)

- Create group with agent + test user.
- Send `@<agentName> <PING_MESSAGE>`.
- Ignore welcome message (filter by timestamp); accept first response after test message.
- Assert agent responds within timeout; report response time.

## 3. Negative untagged (`agents-untagged`)

- Create group with agent + test user.
- Send initial "hi" (welcome); optionally wait for welcome response.
- Send second "hi" (untagged).
- Expect agent does **not** respond; in non-production, assertion is relaxed (monitoring only).

## 4. Stress (`agents-stress`)

- Runs only for agents with `live: false` and matching network.
- Create 50 groups with the agent.
- Send 10 messages per group (500 total).
- No response assertion; validates completion without failure.

## Agent configuration

Config lives in [agents.ts](../agents.ts). Properties:

| Property    | Description |
| ----------- | ----------- |
| `name`      | Agent identifier. |
| `address`   | Ethereum address. |
| `networks`  | Supported networks (`["dev", "production"]`). |
| `live`      | Production flag; stress test runs only when `live: false`. |
| `customText`| Optional message to send instead of default ping. |

Example:

```json
{
  "name": "gm",
  "address": "0x4796C95DDACb0A29c3b2c8295a8b2fB94d5046e9",
  "networks": ["dev", "production"],
  "live": false,
  "customText": "hola"
}
```
