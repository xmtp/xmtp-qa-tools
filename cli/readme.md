# XMTP QA Tools CLI

A comprehensive CLI for testing XMTP protocol implementations across environments and SDK versions.

## Quick Reference

| Command                                      | Purpose               | Help                   |
| -------------------------------------------- | --------------------- | ---------------------- |
| `yarn test <suite>`                          | Run test suites       | `yarn test --help`     |
| `yarn send --address <addr> --users <count>` | Test message delivery | `yarn send --help`     |
| `yarn bot <name>`                            | Run interactive bots  | `yarn bot --help`      |
| `yarn gen`                                   | Generate test data    | `yarn gen --help`      |
| `yarn versions`                              | Manage SDK versions   | `yarn versions --help` |
| `yarn revoke <inbox-id>`                     | Revoke installations  | `yarn revoke --help`   |
| `yarn groups`                                | Create DMs/groups     | `yarn groups --help`   |

## Core Commands

### Test Command

```bash
yarn test <suite> [options]
```

**Test Suites:**

- `functional` - Complete functional tests
- `convos` - Direct message tests
- `groups` - Group conversation tests
- `performance` - Performance metrics
- `delivery` - Message delivery reliability
- `browser` - Playwright automation
- `agents` - Bot monitoring
- `networkchaos` - Network partition tests
- `other` - Security, spam, rate limiting

**Options:**

- `--env <env>` - Environment (local/dev/production) [default: local]
- `--attempts <n>` - Retry attempts [default: 3]
- `--debug` - Enable file logging
- `--no-fail` - Exit with success on failures
- `--parallel` - Run tests in parallel
- `--versions <n>` - Test multiple SDK versions

### Send Command

```bash
yarn send [options]
```

**Options:**

- `--address <addr>` - Target wallet address
- `--env <env>` - XMTP environment [default: local]
- `--users <count>` - Number of users [default: 5]
- `--tresshold <percent>` - Success threshold [default: 95]
- `--wait` - Wait for responses

### Bot Command

```bash
yarn bot <name> [options]
```

**Available Bots:**

- `echo` - Echo bot that responds to messages
- `key-check` - Key validation bot

**Options:**

- `--env <env>` - XMTP environment [default: local]

### Generator Command

```bash
yarn gen [options]
```

**Options:**

- `--count <n>` - Number of inboxes [default: 200]
- `--envs <list>` - Environments (local,dev,production) [default: local]
- `--installations <n>` - Installations per inbox [default: 2]
- `--debug` - Enable debug logging
- `--clean` - Clean logs/ and .data/ directories

### Versions Command

```bash
yarn versions [options]
```

**Options:**

- `--clean` - Clean package.json and node_modules before setup

### Revoke Command

```bash
yarn revoke <inbox-id> [installations-to-save]
```

**Arguments:**

- `inbox-id` - 64-character hex inbox ID
- `installations-to-save` - Comma-separated IDs to keep (optional)

### Groups Command

```bash
yarn groups [options] --target <address> --members <count> --group-name <name> --permissions <type>
```

**Options:**

- `--target <addr>` - Target wallet address
- `--members <count>` - Number of members
- `--group-name <name>` - Group name
- `--permissions <type>` - Permissions (default/admin-only/read-only/open)

## Environment Options

All commands support:

- `local` - Local XMTP network
- `dev` - Development network (default)
- `production` - Production network

## Common Options

Most commands support:

```bash
--env <environment>    # Set XMTP environment
--debug               # Enable file logging
--no-fail             # Exit with success on failures
--help, -h            # Show help
```

## Environment Variables

- `TARGET` - Default target address
- `XMTP_ENV` - Default environment
- `LOGGING_LEVEL` - Logging level
- `WALLET_KEY` - Wallet private key (for revoke)
- `ENCRYPTION_KEY` - Encryption key (for revoke)

## Requirements

- Node.js 20+
- .env file with required keys (for revoke command)

## Examples

```bash
# Quick functionality test
yarn test convos --env dev

# Load testing with response waiting
yarn send --address 0x1234... --env production --users 500 --wait

# Multi-version compatibility testing
yarn test functional --versions 3 --debug

# Generate test data for multiple environments
yarn gen --count 500 --envs local,dev --installations 3

# Run echo bot in development
yarn bot echo --env dev

# Revoke all installations except current
yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64
```

## Help Commands

```bash
yarn test --help       # Test command help
yarn send --help       # Send command help
yarn bot --help        # Bot command help
yarn gen --help        # Generator help
yarn versions --help   # Versions help
yarn revoke --help     # Revoke help
yarn groups --help     # Groups help
```

## Monitoring

```bash
yarn ansi:clean        # Clean raw logs
yarn ansi:forks        # Clean fork logs
```
