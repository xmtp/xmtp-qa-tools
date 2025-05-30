# 📜 Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick reference

| Script            | Purpose                            | Key Features                         |
| ----------------- | ---------------------------------- | ------------------------------------ |
| **gen.ts**        | Creates XMTP client installations  | Multiple client installation creator |
| **cli.ts**        | General-purpose task runner        | Configurable operations              |
| **parse-ansi.ts** | Parses ANSI escape codes from logs | Removes ANSI escape codes from logs  |
| **versions.ts**   | Manages SDK versions               | XMTP SDK version management/symlinks |

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
