# Scripts Quick Reference

## Overview

| Script        | Purpose        | Use Case                                  |
| ------------- | -------------- | ----------------------------------------- |
| `cli.ts`      | Command router | Run tests, bots, scripts with retry logic |
| `versions.ts` | SDK manager    | Setup multiple SDK versions for testing   |
| `stress.ts`   | Stress test    | Run stress tests with retry logic         |

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
--debug-verbose         # File + terminal logging
--no-fail              # Exit 0 on failure
--max-attempts 3       # Retry limit
--retry-delay 10       # Retry delay (seconds)
--parallel             # Parallel execution
--versions 3           # Use 3 SDK versions
--env production       # Set XMTP_ENV
```

## SDK Version Management

```bash
# Full setup
yarn script versions

# Clean first
yarn script versions
```

## Log Files

Logs saved to: `logs/raw-<testname>-<env>-<timestamp>.log`

```bash
--debug                # File only
--debug-verbose        # File + terminal
--debug-file custom    # Custom filename
--no-clean-logs        # Keep logs after test
```

## Functional Testing

```bash
# Multi-version testing
yarn cli test functional --versions 3 --no-fail --debug

# Specific version
yarn cli test regression --nodeVersion 3.1.1 --debug
```

## Stress Testing

````bash

Local env
yarn stress --address 0xb6469a25ba51c59303eb24c04dad0e0ee1127d5b --env dev --users 200

yarn stress --agent gm --env dev --users 200
```


### Fast (optimized defaults):
```bash
yarn cli stress --users 200
````

### Ultra-fast (parallel batches):

```bash
yarn cli stress --users 200 --parallel-batches 3 --batch-delay 50
```

### Maximum speed (no delays):

```bash
yarn cli stress --users 200 --batch-size 100 --batch-delay 0
```
