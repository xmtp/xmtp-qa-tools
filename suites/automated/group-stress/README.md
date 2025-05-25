# XMTP Group Stress Testing Suite

> For details see deployment: https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd/service/d92446b3-7ee4-43c9-a2ec-ceac87082970?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792

- [x] Time factor (30 min recurring)
- [x] Old packages
- [x] Multi-sdk
- [x] 10 second sync strategy
- [x] Package expiration details
- [x] 2 types of streams (conversations and messages)
- [x] Membership change cycles
- [x] Final state consistency

This test suite reproduces group conversation forking issues in XMTP by simulating high-frequency membership changes and message exchanges.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

## Test Overview

The stress test creates a group with **14 multi-version workers** and performs:

1. **Fork-free message delivery** - Verifies messages reach all participants without conversation forks
2. **Fork-free membership delivery** - Tests member addition/removal propagation across clients
3. **Fork-free metadata delivery** - Validates group name and metadata updates sync correctly
4. **Membership change cycles** - Performs 10 epochs of rapid member remove/add operations per worker
5. **Final state consistency** - Confirms all workers maintain synchronized group state

### Worker Configuration

- **Total workers**: 14 (multi-version XMTP clients)
- **Test workers**: 7 (perform membership changes)
- **Check workers**: 6 (verify message/membership delivery)
- **Creator**: 1 bot (group admin)

### Test Cycles

Each test worker undergoes **10 membership cycles** where they are:

- Removed from the group
- Re-added to the group
- Group state is synced

This simulates real-world scenarios where users frequently join/leave groups.

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
yarn test group-stress
```
