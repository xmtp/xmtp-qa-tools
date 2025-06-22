# Group Stress Testing Suite

This test suite validates group conversation stability under high-frequency membership changes and concurrent operations, helping identify forking issues and race conditions in XMTP group conversations.

## What it does

- Simulates intensive group membership changes (add/remove cycles)
- Tests group metadata updates under load (`updateName()`, sync operations)
- Validates message delivery during concurrent group operations
- Monitors group state consistency across multiple client installations
- Tests admin permission management during stress scenarios
- Generates runtime installations to simulate real-world usage

## Environment Setup

Set `XMTP_ENV` to `production` or `dev` to test group stability on the corresponding network.

Create a `.env` file with the following configuration:

```bash
LOGGING_LEVEL=off  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev
GROUP_ID=""  # Auto-populated during testing
```

## How to run

### Run group stress tests

```bash
yarn test group
```

### Run with automated scheduling

```bash
./run.sh
```

## Test Features

### Core Functionality

- ✅ **Multi libxmtp versions** (>2.0.4)
- ✅ **Multi binding support** (web, mobile, desktop)
- ✅ **Membership change cycles** (remove/add operations)
- ✅ **Group metadata updates** (`updateName()`)
- ✅ **Group state synchronization** (`sync()`, `syncAll()`)
- ✅ **Group admin permissions**
- ✅ **Message & update streams**
- ✅ **Runtime installation creation**
- ✅ **Multi-worker concurrency** (14 concurrent workers)
- ✅ **Rate limiting** (message throttling, API call limits)

### Planned Features

- ⏳ **Sync installations**
- ⏳ **Race condition detection**

### Stress Testing Parameters

- **Minimum installations**: 10 per test
- **Concurrent workers**: 14
- **Change frequency**: 30-minute recurring cycles
- **Operations tested**: Add/remove members, metadata updates, message streams

## Test Scenarios

1. **Membership Cycling**: Rapid addition and removal of group members
2. **Concurrent Operations**: Multiple workers performing group operations simultaneously
3. **Metadata Stress**: Frequent group name and setting updates
4. **Stream Validation**: Ensuring message and update streams remain stable
5. **Permission Testing**: Admin operations under concurrent load

## Monitoring & Results

The test suite includes comprehensive monitoring for:

- Group forking detection
- Message delivery consistency
- Stream reliability
- Permission state accuracy
- Installation synchronization

## Known Issues

This test suite specifically targets and helps reproduce:

- Group conversation forking under high load
- Race conditions in membership changes
- Stream inconsistencies during concurrent operations

## Key Files

- **[group.test.ts](./group.test.ts)** - Main stress testing implementation
- **[run.sh](./run.sh)** - Automated test execution script
- **[README.md](./README.md)** - This documentation
