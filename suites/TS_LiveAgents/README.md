# TS_LiveAgents

This test suite validates the health and responsiveness of live XMTP agents in production.

## Overview

The TS_LiveAgents suite performs automated health checks on production XMTP agents by:

- Sending test messages to each agent
- Verifying that the agent responds appropriately
- Reporting test results for monitoring purposes

## Configuration

### Agent List

Agents to be tested are defined in `agents.json`:

```json
[
  {
    "name": "bankr.base.eth",
    "address": "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d"
  },
  {
    "name": "clankerchat.base.eth",
    "address": "0x9E73e4126bb22f79f89b6281352d01dd3d203466"
  }
]
```

To add a new agent for testing, simply add its details to this file.

## GitHub Actions Workflow

The tests are configured to run automatically:

- On a scheduled basis (hourly)
- Manually via workflow dispatch

The workflow configuration is in `.github/workflows/TS_LiveAgents.yml`.

### Environment Variables

The test uses the following environment variables:

| Variable                   | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `DATADOG_API_KEY`          | API key for reporting test results to Datadog       |
| `LOGGING_LEVEL`            | Level of detail for logging                         |
| `XMTP_ENV`                 | XMTP environment to use (defaults to `production`)  |
| `WALLET_KEY_XMTP_CHAT`     | Private key for the test wallet                     |
| `ENCRYPTION_KEY_XMTP_CHAT` | Encryption key for the test client's local database |
| `TARGET_AGENT_NAME`        | Name of the specific agent to test (optional)       |
| `TARGET_AGENT_ADDRESS`     | Address of the specific agent to test (optional)    |

## Test Execution

The test performs these steps:

1. Sets up the test environment
2. Creates a test client using the `bob` worker identity
3. Sends a message to the target agent using the XMTP Playwright helper
4. Validates that the agent responds

If no specific agent is provided via environment variables, the test will default to the first agent in the `agents.json` file.

## Running Locally

To run the tests locally:

```bash
# Run against all agents
yarn test suites/TS_LiveAgents

# Run against a specific agent
TARGET_AGENT_NAME="bankr.base.eth" TARGET_AGENT_ADDRESS="0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d" yarn test suites/TS_LiveAgents
```

## Artifacts

Test logs and results are stored as artifacts in GitHub Actions for diagnostic purposes.
