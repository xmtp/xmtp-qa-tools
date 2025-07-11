# Scripts Quick Reference

## Overview

| Script        | Purpose        | Use Case                                  |
| ------------- | -------------- | ----------------------------------------- |
| `cli.ts`      | Command router | Run tests, bots, scripts with retry logic |
| `versions.ts` | SDK manager    | Setup multiple SDK versions for testing   |

## Common Commands

```bash
# Setup SDK versions
yarn script versions

# Run tests
yarn cli test functional
yarn cli test dms --debug

# Start bots
yarn cli bot gm-bot
yarn cli bot stress 5

# Debug failing tests
yarn cli test dms --debug-verbose --max-attempts 3
```

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
yarn script versions --clean

# What happens:
# 1. Discovers SDK packages
# 2. Creates symlinks
# 3. Verifies compatibility
```

## Test Execution Modes

### Simple Mode

```bash
yarn cli test functional
# Direct vitest execution
```

### Retry Mode

```bash
yarn cli test functional --debug
# Advanced logging, retries, notifications
```

## Environment Variables

```bash
XMTP_ENV=dev           # Required: local, dev, production
LOGGING_LEVEL=off      # Optional: off, debug, info, warn, error
TEST_VERSIONS=3        # Optional: Number of SDK versions
```

## Log Files

Logs saved to: `logs/raw-<testname>-<env>-<timestamp>.log`

```bash
--debug                # File only
--debug-verbose        # File + terminal
--debug-file custom    # Custom filename
--no-clean-logs        # Keep logs after test
```

## Examples

### Development

```bash
# Quick test
yarn cli test dms

# Debug test
yarn cli test dms --debug-verbose

# Setup versions
yarn script versions
```

### Production Monitoring

```bash
# Monitor with retries
XMTP_ENV=production yarn cli test functional --no-fail --debug --max-attempts 5

# Performance testing
XMTP_ENV=production yarn cli test performance --parallel --debug
```

### CI/CD

```bash
# Multi-version testing
yarn cli test functional --versions 3 --no-fail --debug

# Specific version
yarn cli test functional --nodeVersion 3.1.1 --debug
```
