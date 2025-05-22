# XMTP Stress Group Testing Suite (ts_stressgroup)

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
yarn test ts_stressgroup
```

## Test Flow

1. **Group Creation**: Initializes workers and creates a test group
2. **Stress Check**: Targeted messages sent to specific workers to check response
3. **Message Exchange**: Each test worker sends an identified message
4. **Membership Cycling**: Creator performs multiple add/remove cycles (defined by EPOCHS)
   - Each cycle: `removeMembers()` → `addMembers()`
   - Full sync performed between operations

## Performance Metrics

- The test records execution time for key operations:
  - Group creation/initialization
  - Message sending
  - Membership change operations
  - Individual epoch durations

## Results Analysis

- **Reliable Reproduction**: Coinbase Wallet consistently fails
- **Intermittent Issues**: Convos Messenger remains stable
- **Resilient Clients**: Web and Node SDK clients remain stable

The test identifies a correlation between forking and client creation intervals approaching 1 second, suggesting timing-related vulnerabilities in the synchronization process.
