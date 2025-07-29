# XMTP QA Tools CLI

A comprehensive CLI for testing XMTP protocol implementations across environments and SDK versions.

## Quick Reference

| Command                                      | Purpose               | Help                      |
| -------------------------------------------- | --------------------- | ------------------------- |
| `yarn test <suite>`                          | Run test suites       | `yarn test --help`        |
| `yarn send --address <addr> --users <count>` | Test message delivery | `yarn send --help`        |
| `yarn bot <name>`                            | Run interactive bots  | `yarn bot --help`         |
| `yarn gen`                                   | Generate test data    | `yarn gen --help`         |
| `yarn versions`                              | Manage SDK versions   | `yarn versions --help`    |
| `yarn revoke <inbox-id>`                     | Revoke installations  | `yarn revoke --help`      |
| `yarn groups`                                | Create DMs/groups     | `yarn groups --help`      |
| `yarn permissions`                           | Manage permissions    | `yarn permissions --help` |

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

- `--env <env>` - Environment (local/dev/production) [default: production]
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
- `--env <env>` - XMTP environment [default: production]
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

- `--env <env>` - XMTP environment [default: production]

### Generator Command

```bash
yarn gen [options]
```

**Options:**

- `--count <n>` - Number of inboxes [default: 200]
- `--env <list>` - Environments (local,dev,production) [default: production]
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
yarn groups <operation> [options]
```

**Operations:**

- `dm` - Create direct message conversations
- `group` - Create a group with members

**Options:**

- `--env <env>` - XMTP environment [default: production]
- `--dm-count <n>` - Number of DMs to create [default: 1]
- `--group-name <name>` - Group name
- `--group-desc <desc>` - Group description
- `--members <count>` - Number of members [default: 5]
- `--target <addr>` - Target wallet address to invite

### Permissions Command

```bash
yarn permissions <operation> <group-id> [options]
```

**Operations:**

- `list <group-id>` - List all members and their roles
- `info <group-id>` - Show detailed group information
- `update-permissions <group-id>` - Update feature permissions

**Options:**

- `--features <feature-list>` - Comma-separated features to update
- `--permissions <permission-type>` - Permission type to apply
- `--env <env>` - XMTP environment [default: production]
- `--target <addr>` - Target address for operations

**Available Features:**

- `add-member` - Adding new members to group
- `remove-member` - Removing members from group
- `add-admin` - Promoting members to admin
- `remove-admin` - Demoting admins to member
- `add-super-admin` - Promoting to super admin
- `remove-super-admin` - Demoting super admins
- `update-metadata` - Updating group metadata
- `update-permissions` - Changing permission policies

**Available Permissions:**

- `everyone` - All group members can perform action
- `disabled` - Feature is completely disabled
- `admin-only` - Only admins and super admins can perform action
- `super-admin-only` - Only super admins can perform action

**Member Statuses:**

- **Member** - Basic group member (everyone starts here)
- **Admin** - Can add/remove members and update metadata
- **Super Admin** - Has all permissions including managing other admins

## Environment Options

All commands support:

- `local` - Local XMTP network
- `dev` - Development network (default)
- `production` - Production network

## Common Options

## Environment Variables

- `TARGET` - Default target address
- `XMTP_ENV` - Default environment (local/dev/production)
- `LOG_LEVEL` - JS logger level (default: info)
- `LOGGING_LEVEL` - Rust library logger level (default: off)
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
yarn gen --count 500 --env local,dev --installations 3

# Run echo bot in development
yarn bot echo --env dev

# Revoke all installations except current
yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

# List all members and their roles
yarn permissions list 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

# Update metadata permissions to admin-only
yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features update-metadata --permissions admin-only

# Update multiple features at once
yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features add-member,remove-member,update-metadata --permissions admin-only

# Disable a feature completely
yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features update-metadata --permissions disabled
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
yarn permissions --help # Permissions help
```
