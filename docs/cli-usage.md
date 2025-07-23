# Testing CLI

This repository provides a comprehensive CLI interface for testing XMTP protocol implementations across multiple environments and SDK versions.

## Environment Setup

### Required Environment Variables

Before running any tests, you must set up a `.env` file with the following variables:

```bash
# Required for all operations
XMTP_ENV=dev                    # Options: local, dev, production
LOGGING_LEVEL=off               # Options: off, debug, info, warn, error
LOG_LEVEL=debug                 # specific to this repo

# Optional - for Slack notifications and monitoring
SLACK_BOT_TOKEN=xoxb-...        # Slack bot token for notifications
SLACK_CHANNEL=C...              # Slack channel ID for alerts

# Optional - for Datadog log analysis
DATADOG_API_KEY=...             # Datadog API key for log retrieval
DATADOG_APP_KEY=...             # Datadog app key for log retrieval
ANTHROPIC_API_KEY=...           # Claude AI API key for log analysis

# Optional - for REGION testing
REGION=us-east-1           # AWS region for testing
```

### Environment Options

- **`local`**: Local XMTP network for development
- **`dev`**: Development XMTP network (default for testing)
- **`production`**: Production XMTP network (for staging/production tests)

## Core CLI Commands

### Basic Command Structure

```bash
yarn cli <command_type> <name_or_path> [options...]
yarn test <test_suite> [options...]              # Direct vitest execution
yarn bot <bot_name> [args...]                    # Interactive bots
yarn script <script_name> [args...]              # Utility scripts
```

### Test Suites

```bash
# Core Functionality
yarn test functional                     # Complete functional suite
yarn test dms                           # Direct message tests
yarn test groups                        # Group conversation tests

# Performance & Scale
yarn test performance                   # Core performance metrics
yarn test large                        # Large group testing (50-400 members)
yarn test delivery                     # Message delivery reliability
yarn test bench                        # Benchmarking suite

# Cross-Platform & Compatibility
yarn test browser                      # Playwright browser automation
yarn test regression                  # Multi-version compatibility
yarn test agents                      # Live bot monitoring
yarn test mobile                      # Cross-platform mobile testing

# Network & Reliability
yarn test networkchaos                # Network partition tolerance
yarn test other                       # Security, spam detection, rate limiting
yarn test forks                       # Git commit-based testing
yarn test datadog                     # Datadog log analysis and monitoring
```

### Bots

```bash
yarn bot gm-bot                        # GM greeting bot
yarn bot stress 5                      # Stress testing with 5 concurrent users
```

### Scripts

```bash
yarn script gen                        # Generate test inboxes
yarn script versions                   # Setup SDK version testing
```

## Advanced Test Options

### Retry and Debugging

```bash
# Enable retry mode with debugging
yarn test functional --no-fail --debug

# Available options:
--max-attempts <N>      # Max retry attempts (default: 3)
--retry-delay <S>       # Delay between retries in seconds (default: 10)
--debug                 # Enable file logging (logs saved to logs/ directory)
--debug-verbose         # Enable both file logging AND terminal output
--debug-file <name>     # Custom log filename
--no-fail              # Exit with success code even on failures
--parallel             # Run tests in parallel (default: consecutive)
```

### Version Testing

```bash
yarn test functional --versions 3      # Uses 3 random SDK versions
yarn regression                        # Shortcut for version testing

# Available SDK versions:
# - 0.0.47 (Legacy)
# - 1.0.5, 2.0.9, 2.1.0, 2.2.1 (Stable)
# - 3.0.1 (Latest)
```

## Environment-Specific Testing

```bash
# Local development
XMTP_ENV=local yarn test functional

# Development network (most common)
XMTP_ENV=dev yarn test functional

# Production network (use carefully)
XMTP_ENV=production yarn test functional
XMTP_ENV=production yarn test agents
```

## Key Generation and Setup

```bash
yarn gen:keys                          # Generates wallet and encryption keys
yarn gen                               # Generate test inboxes
yarn local-update                      # Generate 500 inboxes for local testing
yarn prod-update                       # Generate 500 inboxes for dev/production
```

## Monitoring and Analysis

### Log Analysis

```bash
yarn ansi                              # Clean raw logs of ANSI escape codes
yarn datadog                          # Fetch and analyze Datadog logs

# Logs are automatically saved when using --debug flag
# Location: logs/raw-<testname>-<env>-<timestamp>.log
```

### UI and Monitoring

```bash
yarn ui                               # Vitest UI for interactive testing
yarn start:dev                       # Starts UI for development
yarn monitor:yarn                     # Monitor XMTP network health
```

## Common Testing Patterns

### Development Testing

```bash
yarn test dms                         # Quick DM functionality test
yarn test groups                      # Quick group functionality test
yarn test functional --no-fail --debug # Full functional suite with debugging
```

### Production Monitoring

```bash
XMTP_ENV=production yarn test agents --no-fail --debug    # Live monitoring
XMTP_ENV=production yarn test performance --debug         # Performance benchmarking
XMTP_ENV=production yarn test large --no-fail --debug     # Large group testing
```

### Multi-Version Compatibility

```bash
yarn test functional --versions 3 --debug                # Version compatibility testing
```

## Shortcut Commands (from package.json)

```bash
# Test Shortcuts
yarn functional                        # yarn test suites/functional
yarn bench                            # yarn test suites/bench/bench.test.ts
yarn large                            # yarn test suites/large
yarn regression                       # yarn test suites/functional --versions 3

# Utility Shortcuts
yarn bot                             # yarn cli bot
yarn datadog                         # yarn test suites/datadog
yarn gen                             # tsx inboxes/gen.ts
yarn clean                           # rimraf .data/ logs/
yarn format                          # prettier -w .
yarn lint                            # eslint .
yarn build                           # tsc

# Development Shortcuts
yarn ui                              # vitest --ui --standalone --watch
yarn start:dev                      # yarn ui
yarn record                         # npx playwright codegen 'https://xmtp.chat/'
```

## Error Handling and Debugging

### Debug Output

- `--debug`: Saves logs to files, minimal terminal output
- `--debug-verbose`: Saves logs to files AND shows full terminal output
- Logs saved to: `logs/raw-<testname>-<env>-<timestamp>.log`

### Notification Systems

When using `--debug` flag, test failures can be analyzed through:

- Structured logging in the logs/ directory
- Datadog integration for centralized log analysis
- Optional Slack notifications for CI/CD alerts

### Exit Codes

- `--no-fail`: Always exits with code 0 (useful for CI monitoring)
- Default: Exits with code 1 on test failures

## Advanced Examples

### Custom Log Files

```bash
yarn test functional --debug-file my-custom-log
# Saves to: logs/my-custom-log-<env>-<timestamp>.log
```

### Multiple Test Files

```bash
yarn test ./suites/functional/dms.test.ts
yarn test ./suites/functional/groups.test.ts ./suites/functional/consent.test.ts
```

### Environment Variables in Commands

```bash
XMTP_ENV=production LOGGING_LEVEL=debug yarn test functional --debug
TEST_VERSIONS=3 yarn test functional
```

### Combining Options

```bash
yarn test functional --versions 3 --max-attempts 5 --retry-delay 30 --debug-verbose --parallel
```

## Best Practices

1. **Always set XMTP_ENV** before running tests
2. **Use --debug for CI/CD** to get proper logging and notifications
3. **Use --no-fail for monitoring** to prevent CI failures on expected issues
4. **Test locally first** before running against dev/production
5. **Use version testing** to catch compatibility issues early
6. **Monitor logs** in the logs/ directory for detailed analysis

```bash
# Advanced example with multiple options
yarn test functional --versions 3 --max-attempts 5 --retry-delay 30 --debug-verbose --parallel
```
