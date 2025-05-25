# XMTP Group Stress Testing Suite

> For details see deployment: https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd/service/d92446b3-7ee4-43c9-a2ec-ceac87082970?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792

- [x] Time factor (30 min recurring)
- [x] Old packages
- [x] Multi-sdk
- [x] 10 second sync strategy
- [x] Package expiration details
- [x] 2 types of streams (conversations and messages)
- [x] Membership change cycles
- [x] Final state consistency

This test suite reproduces group conversation forking issues in XMTP by simulating high-frequency membership changes and message exchanges.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## Configuration

Create a `.env` file in the root directory:

```bash
LOGGING_LEVEL=off  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev

# Auto-populated during testing
GROUP_ID=""

# WORKERS
# where rest of workers will be saved
```

> [!TIP]
> To find your InboxID, message `key-check.eth` with `/kc address`

## Test Execution

```bash
yarn test group-stress
```
