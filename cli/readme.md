# XMTP QA Tools CLI

A comprehensive CLI for testing XMTP protocol implementations across environments and SDK versions.

## Quick Reference

| Command                                     | Purpose               | Help                        |
| ------------------------------------------- | --------------------- | --------------------------- |
| `yarn test <suite>`                         | Run test suites       | `yarn test --help`          |
| `yarn send --target <addr> --users <count>` | Test message delivery | `yarn send --help`          |
| `yarn installations`                        | Manage installations  | `yarn installations --help` |
| `yarn bot <name>`                           | Run interactive bots  | `yarn bot --help`           |
| `yarn revoke <inbox-id>`                    | Revoke installations  | `yarn revoke --help`        |
| `yarn groups`                               | Create DMs/groups     | `yarn groups --help`        |
| `yarn permissions`                          | Manage permissions    | `yarn permissions --help`   |
| `yarn mock`                                 | Mock client           | `yarn mock --help`          |

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
- `--log warn --file` - Enable file logging
- `--no-fail` - Exit with success on failures
- `--parallel` - Run tests in parallel

### Send Command

```bash
yarn send [options]
```

**Options:**

- `--target <addr>` - Target wallet target
- `--env <env>` - XMTP environment [default: production]
- `--users <count>` - Number of users [default: 5]
- `--tresshold <percent>` - Success threshold [default: 95]
- `--wait` - Wait for responses

### Installations Command

```bash
yarn installations [options]
```

**Options:**

- `--create` - Create a new installation
- `--name <name>` - Name for the installation
- `--target <addr>` - Target wallet address to send message to
- `--message <text>` - Message to send to target
- `--list` - List all installations
- `--load <name>` - Load existing installation by name
- `--wallet-key <key>` - Wallet private key (for loading existing installation)
- `--encryption-key <key>` - Encryption key (for loading existing installation)
- `--env <env>` - XMTP environment [default: production]

**Examples:**

```bash
# Create a new installation
yarn installations --create --name "my-installation"

# Create installation and send message
yarn installations --create --target 0x1234... --message "Hello!"

# Load existing installation and send message
yarn installations --load "my-installation" --target 0x1234... --message "Hello!"

# List all installations
yarn installations --list
```

### Bot Command

```bash
yarn bot <name> [options]
```

**Available Bots:**

- `echo` - Echo bot that responds to messages
- `key-check` - Key validation bot

**Options:**

- `--env <env>` - XMTP environment [default: production]

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

- `XMTP_ENV` - Default environment (local/dev/production)
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
yarn send --target 0x1234... --env production --users 500 --wait

# Multi-version compatibility testing
yarn test functional --versions 3 --log warn --file

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

# Mock Client

You can use the mock client to check your own inbox ID and address, list all conversations, and list messages in a conversation.

```bash
yarn mock [options]
```

**Options:**

- `--env <env>` - XMTP environment [default: production]

**Operations:**

- `identity` - Check your own inbox ID and address
- `conversations` - List all conversations
- `messages` - List messages in a conversation
