# Group Stress Testing Suite

This test suite reproduces group conversation forking issues in XMTP by simulating high-frequency membership changes and message exchanges across multiple SDK versions and client types.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

> For details see [deployment](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd/service/d92446b3-7ee4-43c9-a2ec-ceac87082970?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792)

## Features Under Test

- [x] **Multi libxtmp versions** (>2.0.4)
- [x] **Multi binding** (web, mobile, desktop)
- [x] **Membership Change Cycles** (cycles remove/add)
- [x] **Group Metadata Updates** (`updateName()`)
- [x] **Group State Synchronization** (`sync()`, `syncAll()`)
- [x] **Group Admin Permissions**
- [x] **30 min recurring changes**
- [x] **Message & Update Streams**
- [x] **New installations created on run-time**
- [x] **Minimum required installations** (10)
- [x] **Multi-Worker** (14 concurrent workers)
- [x] **Rate Limiting** (message throttling, API call limits)

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

## Test Execution

```bash
yarn test group
```
