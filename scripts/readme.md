# Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

| Script                           | Purpose                     | Key Features                         |
| -------------------------------- | --------------------------- | ------------------------------------ |
| **[cli.ts](./cli.ts)**           | General-purpose task runner | Configurable operations              |
| **[versions.ts](./versions.ts)** | Manages SDK versions        | XMTP SDK version management/symlinks |

## Usage

You can run these scripts using the yarn commands defined in package.json:

```bash
# Generate XMTP keys
yarn gen:keys
# Run a specific script without the extension
yarn script <script-name>
# Run a bot with arguments
yarn bot <bot-name> [args]
```

## CLI

```bash
yarn cli --help
```

```bash
Usage: yarn cli <command_type> <name_or_path> [args...]

Command Types:
  bot <bot_name> [bot_args...]        - Runs a bot (e.g., gm-bot)
  script <script_name> [script_args...] - Runs a script (e.g., gen)
  test [suite_name_or_path] [options...] - Runs tests (e.g., functional)
    Simple vitest execution (default):
      yarn cli test dms        - Runs vitest directly
      yarn cli test ./path/to/test.ts  - Runs specific test file
    Retry mode (when retry options are present):
      --max-attempts <N>  Max number of attempts for tests (default: 3)
      --retry-delay <S>   Delay in seconds between retries (default: 10)
      --parallel          Run tests in parallel (default: consecutive)
      --debug / --no-log    Enable/disable logging to file (default: enabled)
      --debug-verbose     Enable logging to both file AND terminal output
      --debug-file <n>   Custom log file name (default: auto-generated)
      --no-fail           Exit with code 0 even on test failures (still sends Slack notifications)
      --env <environment> Set XMTP_ENV (options: local, dev, production)
      --versions count   Number of SDK versions to use (e.g., 3)
      --nodeVersion ver  Specific Node SDK version to use (e.g., 3.1.1)
      --no-clean-logs    Disable automatic log cleaning after test completion (enabled by default)
      --log-level <level> Set logging level (debug, info, error) (default: debug)
      [vitest_options...] Other options passed directly to vitest

Examples:
  yarn cli bot gm-bot
  yarn cli bot stress 5
  yarn cli script gen
  yarn script versions
  yarn cli test functional
  yarn cli test dms --max-attempts 2
  yarn cli test dms --parallel
  yarn cli test dms --debug-verbose   # Shows output in terminal AND logs to file
  yarn cli test dms --no-fail        # Uses retry mode
  yarn cli test dms --debug        # Uses retry mode
  yarn cli test dms --versions 3 # Uses random workers with versions 2.0.9, 2.1.0, and 2.2.0
  yarn cli test dms --nodeVersion 3.1.1 # Uses workers with SDK version 3.1.1
  yarn cli test dms --env production # Sets XMTP_ENV to production
  yarn cli test dms --no-clean-logs  # Disable automatic log cleaning
  yarn cli test dms --log-level error  # Set logging level to error

```

## Versions

```bash
yarn script versions
```

```bash
Found 9 SDK packages and 10 bindings packages
Creating bindings symlinks...
Linked: 3.1.2 -> 1.2.8
3.1.2 -> 1.2.8 (3562697)
Linked: 3.1.1 -> 1.2.7
3.1.1 -> 1.2.7 (ec4b933)
Linked: 3.0.1 -> 1.2.5
3.0.1 -> 1.2.5 (dc3e8c8)
Linked: 2.2.1 -> 1.2.2
2.2.1 -> 1.2.2 (d0f0b67)
Linked: 2.1.0 -> 1.2.0
2.1.0 -> 1.2.0 (7b9b4d0)
Linked: 2.0.9 -> 1.1.8
2.0.9 -> 1.1.8 (bfadb76)
Linked: 1.0.5 -> 1.1.3
1.0.5 -> 1.1.3 (6eb1ce4)
Linked: 0.0.47 -> 0.4.1
0.0.47 -> 0.4.1 (6bd613d)
Linked: 0.0.13 -> 0.0.9

Verifying SDK versions...
```
