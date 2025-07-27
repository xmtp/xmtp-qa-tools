# Scripts Quick Reference

## Overview

| Script        | Purpose              | Use Case                                     |
| ------------- | -------------------- | -------------------------------------------- |
| `test.ts`     | Test runner          | Run tests with retry logic                   |
| `versions.ts` | SDK manager          | Setup multiple SDK versions for testing      |
| `send.ts`     | send test            | Run send tests with retry logic              |
| `revoke.ts`   | Installation manager | Revoke XMTP installations for inboxes        |
| `gen.ts`      | Data generator       | Generate test data and inboxes               |
| `bot.ts`      | Bot launcher         | Launch interactive bots from bots/ directory |

## CLI Command Structure

```
yarn cli <type> <name> [options]
```

### Types

- `bot` - Interactive bots with watch mode
- `script` - One-time utility scripts
- `test` - Test suites with retry logic

### Common Options

```bash
--debug                 # File logging
--no-fail              # Exit 0 on failure
--attempts 3       # Retry limit
--parallel             # Parallel execution
--versions 3           # Use 3 SDK versions
--env production       # Set XMTP_ENV
```

## SDK Version Management

```bash
# Full setup
yarn versions

# Clean first
yarn versions
```

## Log Files

Logs saved to: `logs/raw-<testname>-<env>-<timestamp>.log`

```bash
--debug                # File only
```

## Functional Testing

```bash
# Multi-version testing
yarn test functional --versions 3 --no-fail --debug
```

## send Testing

```bash
# Local env
yarn send --address 0xb6469a25ba51c59303eb24c04dad0e0ee1127d5b --env dev --users 200

yarn send --agent gm --env dev --users 200
```

## Bot Management

```bash
# Launch available bots
yarn bot echo --env dev
yarn bot key-check
```

## Data Generation

```bash
# Generate test data and inboxes
yarn gen
```

## Installation Management

```bash
# Revoke installations for an inbox
yarn revoke-installations <inbox-id> [installations-to-save]
```
