# CLI usage guide

This covers the core CLI commands for running XMTP QA tests, bots, and scripts. For test suite details, see [test suites](./test-suites.md).

## Setup

Create a `.env` file:

```bash
XMTP_ENV=dev
LOGGING_LEVEL=debug
# Optional: SLACK_BOT_TOKEN, DATADOG_API_KEY, etc.
```

Install dependencies:

```bash
yarn install
```

## Core commands

### Running tests

```bash
yarn test functional  # Core protocol tests
yarn test performance # Benchmarks
yarn test large       # Large groups (50-400 members)
yarn test agents      # Bot monitoring
yarn test browser     # Browser compatibility
```

### Running bots

```bash
yarn bot gm-bot       # Greeting bot
yarn bot stress 5     # Stress test with 5 users
```

### Running scripts

```bash
yarn script gen       # Generate test inboxes
yarn script versions  # Setup SDK versions
```

## Advanced options

Add flags for retries and debugging:

```bash
yarn test functional --debug --max-attempts 3 --retry-delay 10
yarn test functional --versions 3 --parallel
```

Version testing:

```bash
yarn test functional --versions 3  # Test with 3 SDK versions
```

Environment-specific:

```bash
XMTP_ENV=production yarn test agents --no-fail --debug
```

## Shortcuts

From package.json:

```bash
yarn functional  # = yarn test suites/functional
yarn regression  # = yarn test functional --versions 3
yarn datadog     # Datadog log analysis
yarn gen         # Generate inboxes
yarn clean       # Clear data and logs
```

For full details, see the root README.md or workspace rules.
