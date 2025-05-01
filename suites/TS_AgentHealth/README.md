# TS_AgentHealth

This test suite validates the health and responsiveness of live XMTP agents in production.

## Overview

The TS_AgentHealth suite performs automated health checks on production XMTP agents by:

- Sending test messages to each agent
- Verifying that the agent responds appropriately
- Reporting test results for monitoring purposes

## Configuration

### Agent List

Agents to be tested are defined in `agents.json`:

```json
[
  {
    "name": "csx-concierge",
    "address": "0x74563b2e03f8539ea0ee99a2d6c6b4791e652901",
    "networks": ["dev"],
    "sendMessage": "hi",
    "expectedMessage": "chat"
  },
  {
    "name": "key-check.eth",
    "address": "0x235017975ed5F55e23a71979697Cd67DcAE614Fa",
    "networks": ["production"],
    "sendMessage": "/kc",
    "expectedMessage": "Key Check"
  },
  {
    "name": "gm-bot",
    "address": "0x20b572be48527a770479744aec6fe5644f97678b",
    "networks": ["production", "dev"],
    "sendMessage": "hi",
    "expectedMessage": "gm"
  },
  {
    "name": "bankr.base.eth",
    "address": "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d",
    "networks": ["production"],
    "sendMessage": "hi",
    "expectedMessage": "hey"
  },
  {
    "name": "clankerchat.base.eth",
    "address": "0x9E73e4126bb22f79f89b6281352d01dd3d203466",
    "networks": ["production"],
    "sendMessage": "hi",
    "expectedMessage": "hey"
  }
]
```

To add a new agent for testing, simply add its details to this file.

## GitHub Actions Workflow

The tests are configured to run automatically:

- On a scheduled basis (hourly)
- Manually via workflow dispatch

The workflow configuration is in `.github/workflows/TS_AgentHealth.yml`.

## Test Execution

The test performs these steps:

1. Sets up the test environment
2. Creates a test client using the `bob` worker identity
3. Sends a message to the target agent using the XMTP Playwright helper
4. Validates that the agent responds

If no specific agent is provided via environment variables, the test will default to the first agent in the `agents.json` file.

## Artifacts

Test logs and results are stored as artifacts in GitHub Actions for diagnostic purposes.
