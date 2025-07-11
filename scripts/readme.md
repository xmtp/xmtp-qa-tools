# Scripts

Core utility scripts for XMTP QA Tools CLI operations.

For quick reference, see [REFERENCE.md](./REFERENCE.md)

## Available Scripts

| Script        | Purpose                  | Main Functions                                             |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| `cli.ts`      | Universal command router | Test execution, bot management, script running             |
| `versions.ts` | SDK version manager      | Version discovery, symlink creation, dependency management |

## Quick Start

```bash
# Run any script
yarn cli <command_type> <name> [options]

# Common shortcuts
yarn script versions     # Setup SDK versions
yarn bot gm-bot         # Start GM bot
yarn test functional    # Run functional tests
```

## CLI Command Reference

### Command Types

```bash
# Bot commands
yarn cli bot <bot_name> [args]
yarn cli bot gm-bot
yarn cli bot stress 5

# Script commands
yarn cli script <script_name> [args]
yarn cli script gen
yarn cli script versions

# Test commands
yarn cli test <test_name> [options]
yarn cli test functional
yarn cli test dms --debug
```

### Test Options

#### Basic Testing

```bash
yarn cli test functional              # Simple execution
yarn cli test dms                     # Direct message tests
yarn cli test ./path/to/test.ts       # Specific test file
```

#### Advanced Testing (Retry Mode)

```bash
yarn cli test functional --debug                    # Enable logging
yarn cli test functional --debug-verbose           # Log + terminal output
yarn cli test functional --no-fail                 # Always exit 0
yarn cli test functional --max-attempts 3         # Retry up to 3 times
yarn cli test functional --retry-delay 10          # 10s delay between retries
yarn cli test functional --parallel                # Parallel execution
```

#### Version Testing

```bash
yarn cli test functional --versions 3              # Use 3 random SDK versions
yarn cli test functional --nodeVersion 3.1.1       # Use specific SDK version
```

#### Environment Control

```bash
yarn cli test functional --env production          # Set XMTP_ENV
yarn cli test functional --log-level error         # Set log level
yarn cli test functional --debug-file custom       # Custom log filename
```

### Option Combinations

```bash
# Production monitoring setup
yarn cli test functional --env production --no-fail --debug --max-attempts 5

# Development debugging
yarn cli test dms --debug-verbose --retry-delay 5 --max-attempts 2

# CI/CD pattern
yarn cli test functional --no-fail --debug --versions 3 --parallel
```

## SDK Version Management

### Basic Version Setup

```bash
yarn script versions                    # Discover and setup all SDK versions
yarn script versions --clean          # Clean package.json imports first
```

### What It Does

```bash
# Discovers packages
Found 9 SDK packages and 10 bindings packages

# Creates symlinks
Linked: 3.1.2 -> 1.2.8
Linked: 3.1.1 -> 1.2.7
Linked: 3.0.1 -> 1.2.5

# Verifies versions
Verifying SDK versions...
```

## Environment Variables

### Required

```bash
XMTP_ENV=dev                    # Network: local, dev, production
LOGGING_LEVEL=off              # Logging: off, debug, info, warn, error
```

### Optional

```bash
SLACK_BOT_TOKEN=xoxb-...       # Slack notifications
SLACK_CHANNEL=C...             # Slack channel
DATADOG_API_KEY=...            # Datadog integration
TEST_VERSIONS=3                # SDK version count
NODE_VERSION=3.1.1             # Specific SDK version
```

## Log Management

### Default Behavior

```bash
# Logs saved to logs/raw-<testname>-<env>-<timestamp>.log
yarn cli test functional --debug

# Auto-cleaned after completion
yarn cli test functional --debug --no-clean-logs    # Disable cleaning
```

### Log Levels

```bash
--debug                        # File logging only
--debug-verbose               # File + terminal output
--debug-file mylog            # Custom filename
--log-level error             # Set log level
```

## Script Integration

### Package.json Shortcuts

```bash
# Direct shortcuts (from package.json)
yarn functional               # yarn cli test functional
yarn bot                     # yarn cli bot
yarn gen                     # yarn cli script gen

# With options
yarn functional --debug      # Passes options through
```

### CI/CD Usage

```bash
# GitHub Actions patterns
XMTP_ENV=production yarn cli test functional --no-fail --debug
XMTP_ENV=production yarn cli test performance --no-fail --debug --parallel
```

## Error Handling

### Exit Codes

```bash
# Normal behavior
yarn cli test functional      # Exit 1 on failure

# CI-friendly behavior
yarn cli test functional --no-fail    # Always exit 0, send notifications
```

### Retry Logic

```bash
# Automatic retries with exponential backoff
yarn cli test functional --max-attempts 3 --retry-delay 10

# Immediate retry
yarn cli test functional --max-attempts 3 --retry-delay 0
```

## File Structure

```
scripts/
├── cli.ts          # Main CLI router and test execution
├── versions.ts     # SDK version management and symlinks
├── readme.md       # Complete documentation
└── REFERENCE.md    # Quick reference guide
```

## Advanced Examples

### Multi-Version Testing

```bash
# Test compatibility across 3 random SDK versions
yarn cli test functional --versions 3 --parallel --debug

# Test specific SDK version
yarn cli test functional --nodeVersion 3.1.1 --debug
```

### Production Monitoring

```bash
# Full production test suite
XMTP_ENV=production yarn cli test functional --no-fail --debug --max-attempts 5 --retry-delay 30

# Performance monitoring
XMTP_ENV=production yarn cli test performance --no-fail --debug --parallel
```

### Development Workflow

```bash
# Quick local test
yarn cli test dms

# Debug failing test
yarn cli test dms --debug-verbose --max-attempts 1

# Setup versions for development
yarn script versions --clean
```
