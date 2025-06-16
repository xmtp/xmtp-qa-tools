# Agent Health Testing Suite

This test suite validates the health and responsiveness of live XMTP agents in production environments.

## What it does (units)

- Create DM conversation with agent using their Ethereum address
- Send configured test message to agent
- Verify agent responds within expected timeframe
- Validate message delivery and response patterns

## Environment Setup

Set `XMTP_ENV` to either `dev` or `production` to test agents on the corresponding network.

## How to run

### Run all agent tests

```bash
yarn test agents
```

## Configuration

The `production.json` file contains agent configurations with these fields:

- `name` - Agent identifier
- `address` - Ethereum address of the agent
- `sendMessage` - Test message to send to the agent
- `networks` - Array of networks the agent supports (`["dev", "production"]`)
- `disabled` - Optional flag to skip testing this agent
- `expectedMessage` - Optional array of expected response keywords

## Key files

- **[production.json](./production.json)** - Configuration file containing agents to test with their addresses, test messages, and supported networks
- **[agents.test.ts](./agents.test.ts)** - Main test implementation
- **[GitHub Actions Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)** - Automated test execution configuration
