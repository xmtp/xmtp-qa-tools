# CLI usage

Create .env:

```bash
XMTP_ENV=dev
LOGGING_LEVEL=debug
```

yarn install

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

See workspace rules for full command details.

```bash
yarn test functional
yarn bot gm-bot
yarn script gen
yarn test functional --debug --versions 3
```
