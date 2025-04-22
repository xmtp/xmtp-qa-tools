# XMTP Fork Testing Suite

This test suite reproduces group conversation forking issues in XMTP by simulating high-frequency membership changes and message exchanges.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

## Test Environment

- **Client Mix**: 8 programmatic workers + 4 manual clients
- **SDKs Tested**: Node SDK (bots) and various client implementations
- **Applications**: Convos.io, Convos Desktop, XMTP Chat Web, Coinbase Wallet iOS

## Setup

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the `bugs/bug_fork` directory:

```bash
LOGGING_LEVEL="off"  # Options: debug, info, warn, error
XMTP_ENV="production"  # Options: production, dev
WORKERS=8  # Number of programmatic workers
EPOCHS=6   # Number of add/remove cycles to perform

# Manual client InboxIDs
USER_CONVOS=""
USER_CONVOS_DESKTOP=""
USER_CB_WALLET=""
USER_XMTPCHAT=""

# Auto-populated during testing
GROUP_ID=""
```

> [!TIP]
> To find your InboxID, message `key-check.eth` with `/kc address`

## Test Execution

```bash
yarn test fork
```

## Test Flow

1. **Group Creation**: Initializes workers and creates a test group
2. **Fork Check**: Targeted messages sent to specific workers to check response
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

- **Reliable Reproduction**: Coinbase Wallet consistently forks
- **Intermittent Issues**: Convos Messenger occasionally forks
- **Resilient Clients**: Web and Node SDK clients remain stable

The test identifies a correlation between forking and client creation intervals approaching 1 second, suggesting timing-related vulnerabilities in the synchronization process.
