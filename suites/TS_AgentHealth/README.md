# XMTP Agent Health Testing Suite (TS_AgentHealth)

This test suite validates the health and responsiveness of live XMTP agents in production environments.

## Test Environment

- **Client**: Single worker "bob" for interaction with various agents
- **Agent Addresses**: Configurable via `agents.json`
- **Testing Approach**: Programmatic testing via XMTP SDK

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

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

## Test Execution

```bash
yarn test ts_agenthealth
```

## Test Flow

1. **Environment Setup**:

   - Sets up the test environment based on configuration
   - Creates a test client using the "bob" worker identity

2. **Agent Communication**:

   - Sends a test message to each target agent
   - Waits for and validates the agent's response
   - Records response times and success/failure status

3. **Result Reporting**:
   - Reports test results for monitoring purposes
   - Logs detailed diagnostic information for failed tests

## Performance Metrics

- Agent response time
- End-to-end message delivery performance
- Success/failure rate across multiple agents

## Key Features Tested

- Agent responsiveness in direct messages
- Agent availability across environments (dev/production)
- Message delivery and response timing
- Basic agent functionality through command testing

## GitHub Actions Workflow

The tests are configured to run automatically:

- On a scheduled basis (hourly)
- Manually via workflow dispatch

The workflow configuration is in `.github/workflows/TS_AgentHealth.yml`.

## Artifacts

Test logs and results are stored as artifacts in GitHub Actions for diagnostic purposes.
