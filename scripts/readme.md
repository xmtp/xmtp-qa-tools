# 📜 Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick reference

| Script              | Purpose                           | Key Features                         |
| ------------------- | --------------------------------- | ------------------------------------ |
| **xmtp-gen.ts**     | Creates XMTP client installations | Multiple client installation creator |
| **local-update.ts** | Updates local inboxes             | Local environment configuration      |
| **railway.sh**      | Railway deployment script         | Railway management                   |
| **run.ts**          | General-purpose task runner       | Configurable operations              |
| **run-test.sh**     | Runs tests                        | Test execution                       |
| **versions.ts**     | Manages SDK versions              | XMTP SDK version management/symlinks |
| **ts200.ts**        | Test 200                          | Test 200                             |

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
