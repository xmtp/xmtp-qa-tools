# XMTP QA Tools CLI

This repository provides a comprehensive CLI interface for testing XMTP protocol implementations across multiple environments and SDK versions.

## Quick start

```bash
# Test functionality
yarn test functional --env dev

# Send messages
yarn send --address 0x1234... --env dev

# Run bots
yarn bot echo --env dev

# Generate test data
yarn gen --count 500 --envs local

# Manage versions
yarn versions --clean

# Revoke installations
yarn revoke <inbox-id>
```

## CLI Commands

### Core Commands

| Command             | Description                     | Help                   |
| ------------------- | ------------------------------- | ---------------------- |
| `yarn test <suite>` | Run test suites                 | `yarn test --help`     |
| `yarn send`         | Send messages and test delivery | `yarn send --help`     |
| `yarn bot <name>`   | Run interactive bots            | `yarn bot --help`      |
| `yarn gen`          | Generate test inboxes and keys  | `yarn gen --help`      |
| `yarn versions`     | Manage SDK versions             | `yarn versions --help` |
| `yarn revoke <id>`  | Revoke installations            | `yarn revoke --help`   |

### Test Suites

```bash
# Core functionality
yarn test functional     # Complete functional suite
yarn test convos         # Direct message tests
yarn test groups         # Group conversation tests

# Performance & scale
yarn test performance    # Core performance metrics
yarn test delivery       # Message delivery reliability

# Cross-platform & compatibility
yarn test browser        # Playwright browser automation
yarn test agents         # Live bot monitoring

# Network & reliability
yarn test networkchaos   # Network partition tolerance
yarn test other          # Security, spam detection, rate limiting
yarn test forks          # Git commit-based testing
```

### Environment Options

- **`local`**: Local XMTP network for development
- **`dev`**: Development XMTP network (default)
- **`production`**: Production XMTP network

### Common Options

```bash
--env <environment>    # Set XMTP environment
--debug               # Enable file logging
--no-fail             # Exit with success code even on failures
--help, -h            # Show help for any command
```

## Examples

### Development Testing

```bash
# Quick functionality test
yarn test convos --env dev

# Full functional suite with debugging
yarn test functional --env dev --debug --no-fail

# Send test messages
yarn send --address 0x1234... --env dev --users 10
```

### Multi-Version Testing

```bash
# Version compatibility testing
yarn test functional --versions 3 --debug

# Setup version testing
yarn versions --clean
```

## Key Generation and Setup

```bash
# Generate test data
yarn gen --count 500 --envs local

# Preset commands
yarn update:local      # Generate 500 inboxes for local testing
yarn update:prod       # Generate inboxes for production testing
```

## Monitoring and Analysis

```bash
# Log analysis
yarn ansi:clean        # Clean raw logs
yarn ansi:forks        # Clean fork logs

# Interactive testing
yarn ui                # Vitest UI
```

## Getting Help

Each CLI command provides detailed help:

```bash
yarn test --help       # Test command help
yarn send --help       # Send command help
yarn bot --help        # Bot command help
yarn gen --help        # Generator help
yarn versions --help   # Versions help
yarn revoke --help     # Revoke help
```

## Best Practices

1. **Use `--help`** to see all available options for any command
2. **Use `--debug`** for CI/CD to get proper logging
3. **Use `--no-fail`** for monitoring to prevent CI failures
4. **Test locally first** before running against dev/production
5. **Use version testing** to catch compatibility issues early
