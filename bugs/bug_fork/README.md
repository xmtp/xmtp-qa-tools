# XMTP Group fork testing

Tests XMTP group functionality with mixed clients to identify and reproduce forking issues.

## Overview

The test suite systematically tests group conversations across multiple client types to identify "forking" issues - where clients diverge in their view of the conversation state.

![Fork Visualization](https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939)

## Test environment

- **8 SDK Bots**: Running on the latest node-sdk
- **4 Manual Clients**: Convos.io, Convos Desktop, XMTP Chat Web, Coinbase Wallet (iOS)

## Configuration

Create a `.env` file in the `bugs/bug_fork` directory:

```bash
LOGGING_LEVEL="off"  # Options: debug, info, warn, error
XMTP_ENV="production"  # Options: production, dev
EPOCHS=4 # Number of add/remove cycles per participant
WORKERS=12 # Number of node-sdk participants
USER_CONVOS=""  # InboxID
USER_CB_WALLET=""  # InboxID
USER_XMTPCHAT=""  # InboxID
USER_CONVOS_DESKTOP=""  # InboxID
GROUP_ID=""  # Will be populated during test execution
```

> [!TIP]
> To find your InboxID, send a message to `key-check.eth` or `0x235017975ed5F55e23a71979697Cd67DcAE614Fa`
> Send `/kc address` to receive your wallet address and inbox ID

## Execution

```bash
yarn test fork
```

## Test methodology

1. **Initialization**:

   - Creates/retrieves test group with all participants
   - Updates group name with timestamp for identification

2. **Message exchange**:

   - Test workers send messages with their identifier

3. **Membership manipulation**:

   - Creator performs multiple add/remove cycles on test participants:

   ```typescript
   await group.sync();
   await group.removeMembers([memberInboxId]);
   await group.sync();
   await group.addMembers([memberInboxId]);
   ```

4. **Fork verification**:
   - Non-test workers are mentioned to check for responses
   - A forked client won't see messages from other branches

## Observed behavior

- **Coinbase Wallet**: Forks consistently
- **Convos Messenger**: Forks less consistently but reproducible
- **Web and Node SDK clients**: Do not experience forking

In the forked state:

- Push notifications continue to reach Coinbase Wallet
- Clients in different branches cannot see each other's messages
- The fork persists until clients restart or resync

## Technical details

- **Total SDK calls per test**: 51 calls
- Correlation between forking and SDK performance when client creation intervals approach 1 second

![Performance Correlation](https://github.com/user-attachments/assets/e3836192-1be5-44bf-8738-3b15a185b842)

## Testing the fork

To manually check for forks after the automated test:

1. Mention multiple workers in one message:

   ```
   hi frank fabri dave grace eve
   ```

2. In a forked group:
   - You'll only receive responses from workers in your branch
   - Clients in different branches won't see each other's messages

## Setup instructions

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```
