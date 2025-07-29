# XMTP QA Tools CLI

This repository provides a comprehensive CLI interface for testing XMTP protocol implementations across multiple environments and SDK versions.

## Overview

The CLI consists of several specialized commands for different testing and management tasks:

| Command                                         | Description                     | Help                   |
| ----------------------------------------------- | ------------------------------- | ---------------------- |
| `yarn test <suite>`                             | Run test suites                 | `yarn test --help`     |
| `yarn send --address <address> --users <count>` | Send messages and test delivery | `yarn send --help`     |
| `yarn bot <name>`                               | Run interactive bots            | `yarn bot --help`      |
| `yarn gen`                                      | Generate test inboxes and keys  | `yarn gen --help`      |
| `yarn versions`                                 | Manage SDK versions             | `yarn versions --help` |
| `yarn revoke <inbox-id> <installation-id>`      | Revoke installations            | `yarn revoke --help`   |
| `yarn groups`                                   | Create dms,groups               | `yarn groups --help`   |

## Test command

The `test` command runs comprehensive test suites for XMTP functionality across different environments and SDK versions.

### Usage

```bash
yarn test <test-suite> [options]
```

### Arguments

- `test-suite` - Test suite name (functional, convos, groups, etc.)

### Options

- `--env <environment>` - XMTP environment (local, dev, production) [default: local]
- `--attempts <number>` - Maximum retry attempts [default: 3]
- `--debug` - Enable file logging (saves to logs/ directory)
- `--no-fail` - Exit with success code even on failures
- `--parallel` - Run tests in parallel (default: consecutive)
- `--versions <count>` - Use multiple SDK versions for testing

### Available test suites

**Core functionality:**

- `functional` - Complete functional test suite
- `convos` - Direct message tests
- `groups` - Group conversation tests

**Performance & scale:**

- `performance` - Core performance metrics and large groups
- `delivery` - Message delivery reliability
- `bench` - Benchmarking suite

**Cross-platform & compatibility:**

- `browser` - Playwright browser automation
- `agents` - Live bot monitoring

**Network & reliability:**

- `networkchaos` - Network partition tolerance
- `other` - Security, spam detection, rate limiting
- `forks` - Git commit-based testing

### Examples

```bash
# Quick functionality test
yarn test convos --env dev

# Full functional suite with debugging
yarn test functional --env dev --debug --no-fail

# Multi-version compatibility testing
yarn test functional --versions 3 --debug

# Parallel performance testing
yarn test performance --parallel --env production
```

## Send command

The `send` command simulates multiple users sending messages to test delivery reliability and performance.

### Usage

```bash
yarn send [options]
```

### Options

- `--address <address>` - Target wallet address to send messages to
- `--env <environment>` - XMTP environment (local, dev, production) [default: local]
- `--users <count>` - Number of users to simulate [default: 5]
- `--tresshold <percent>` - Success threshold percentage [default: 95]
- `--wait` - Wait for responses from target

### Environment Variables

- `ADDRESS` - Default target address
- `XMTP_ENV` - Default environment
- `LOGGING_LEVEL` - Logging level

### Examples

```bash
# Basic message sending test
yarn send --address 0x1234... --env dev --users 10

# Production load testing with response waiting
yarn send --address 0x1234... --env production --users 500 --wait

# Custom success threshold
yarn send --address 0x1234... --tresshold 90 --users 100
```

## Bot command

The `bot` command runs interactive XMTP bots for testing and monitoring purposes.

### Usage

```bash
yarn bot <bot-name> [options]
```

### Arguments

- `bot-name` - Name of the bot to run (echo, key-check)

### Options

- `--env <environment>` - XMTP environment (local, dev, production) [default: local]

### Available bots

- `echo` - Echo bot that responds to messages
- `key-check` - Key validation bot

### Examples

```bash
# Run echo bot in development environment
yarn bot echo --env dev

# Run key validation bot locally
yarn bot key-check --env local
```

## Generator command

The `gen` command generates test inboxes and encryption keys for testing across multiple environments.

### Usage

```bash
yarn gen [options]
```

### Options

- `--count <number>` - Number of inboxes to generate [default: 200]
- `--envs <environments>` - Comma-separated environments (local,dev,production) [default: local]
- `--installations <num>` - Number of installations per inbox [default: 2]
- `--debug` - Enable debug logging
- `--clean` - Clean up logs/ and .data/ directories before running

### Preset commands

```bash
yarn update:local      # Generate 500 inboxes for local testing
yarn update:prod       # Generate inboxes for production testing
```

### Examples

```bash
# Generate test data for local environment
yarn gen --count 500 --envs local

# Multi-environment setup
yarn gen --envs local,dev --installations 3

# Clean setup with debugging
yarn gen --clean --debug
```

## Versions command

The `versions` command manages SDK version testing by creating bindings symlinks for different XMTP SDK versions.

### Usage

```bash
yarn versions [options]
```

### Options

- `--clean` - Clean package.json imports and node_modules before setup

### Description

Sets up SDK version testing by creating bindings symlinks for different XMTP SDK versions. This enables testing across multiple SDK versions simultaneously.

### Examples

```bash
# Standard version setup
yarn versions

# Clean setup
yarn versions --clean
```

## Revoke command

The `revoke` command revokes installations for a given inbox, useful for testing installation management.

### Usage

```bash
yarn revoke <inbox-id> [installations-to-save]
```

### Arguments

- `inbox-id` - 64-character hexadecimal inbox ID
- `installations-to-save` - Comma-separated installation IDs to keep (optional)

### Description

Revokes all installations for a given inbox except those specified in installations-to-save. If no installations are specified, only the current installation is kept.

### Requirements

- Node.js version 20 or higher
- .env file with WALLET_KEY, ENCRYPTION_KEY, and XMTP_ENV

### Examples

```bash
# Revoke all installations except current
yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

# Keep specific installations
yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 "current-installation-id,another-installation-id"
```

## Environment options

All commands support the following environments:

- **`local`**: Local XMTP network for development
- **`dev`**: Development XMTP network (default)
- **`production`**: Production XMTP network

## Common options

Most commands support these common options:

```bash
--env <environment>    # Set XMTP environment
--debug               # Enable file logging
--no-fail             # Exit with success code even on failures
--help, -h            # Show help for any command
```

## Getting help

Each CLI command provides detailed help:

```bash
yarn test --help       # Test command help
yarn send --help       # Send command help
yarn bot --help        # Bot command help
yarn gen --help        # Generator help
yarn versions --help   # Versions help
yarn revoke --help     # Revoke help
```

## Monitoring and analysis

```bash
# Log analysis
yarn ansi:clean        # Clean raw logs
yarn ansi:forks        # Clean fork logs
```

## Groups command

The `groups` command creates Direct Messages (DMs) and groups with specified permissions.

### Usage

```bash
yarn groups [options] --target <address> --members <count> --group-name <name> --permissions <type>
```

### Options

- `--target <address>` - Target wallet address to invite to group
- `--members <count>` - Number of members to invite to group
- `--group-name <name>` - Name of the group to create
- `--permissions <type>` - Type of permissions to set (default, admin-only, read-only, open)
