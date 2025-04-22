# 🔍 TS_Fork test suite

This test suite verifies XMTP group functionality with mixed clients to identify and reproduce forking issues in group conversations.

## Table of contents

- [Overview](#overview)
- [Implementation details](#implementation-details)
- [Configuration](#configuration)
- [Test methodology](#test-methodology)
- [Observed behavior](#observed-behavior)
- [Technical details](#technical-details)
- [Testing the fork](#testing-the-fork)

## Overview

The TS_Fork test suite systematically tests group conversation functionality across multiple client types to identify and reproduce "forking" issues - where clients diverge in their view of the conversation state.

![Fork Visualization](https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939)

### Test environment

The test suite uses a mixed-client environment to maximize fork reproducibility:

- **8 SDK Bots**: Running on the latest node-sdk version
- **4 Manual Clients**:
  - Convos.io
  - Convos Desktop
  - XMTP Chat Web
  - Coinbase Wallet (iOS build)

## Implementation details

The test suite focuses on:

- Group creation across mixed clients
- Message delivery and reception validation
- Member addition and removal operations
- Fork detection by message response verification

Configuration parameters include:

```javascript
// Configuration parameters from TS_Fork
const testConfig = {
  testName: testName,
  workers: parseInt(process.env.WORKERS ?? "8"),
  epochs: parseInt(process.env.EPOCHS ?? "4"),
  manualUsers: {
    USER_XMTPCHAT: process.env.USER_XMTPCHAT,
    USER_CONVOS: process.env.USER_CONVOS,
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP,
    USER_CB_WALLET: process.env.USER_CB_WALLET,
  },
  groupId: process.env.GROUP_ID,
};
```

Key implementation highlights:

```javascript
// Example from TS_Fork implementation
const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  epochs: number,
): Promise<void> => {
  // ...
  for (let i = 0; i < epochs; i++) {
    try {
      const epochStart = performance.now();
      await group.sync();
      await group.removeMembers([memberInboxId]);
      await group.sync();
      await group.addMembers([memberInboxId]);

      await group.updateName(`Fork Test Group ${time} - Cycle ${i + 1}`);
      const epochEnd = performance.now();
      console.log(`Epoch ${i + 1} completed in ${epochEnd - epochStart}ms`);
    } catch (e) {
      console.error(`Error in epoch ${i + 1} for ${memberToAdd.name}:`, e);
    }
  }
  // ...
};
```

## Configuration

Create a `.env` file in the `bugs/ts_fork` directory with the following parameters:

```bash
LOGGING_LEVEL="off"  # Options: debug, info, warn, error
XMTP_ENV="production"  # Options: production, dev
EPOCHS=4 # Number of add/remove cycles per participant
WORKERS=8 # Number of node-sdk participants in the test
USER_CONVOS=""  # InboxID
USER_CB_WALLET=""  # InboxID
USER_XMTPCHAT=""  # InboxID
USER_CONVOS_DESKTOP=""  # InboxID

# Will be populated during test execution
GROUP_ID=""  # Group ID will be stored here for reuse
```

> [!TIP]
> To find your InboxID, send a message to `key-check.eth` or `0x235017975ed5F55e23a71979697Cd67DcAE614Fa`
> Send `/kc address` to receive your wallet address and inbox ID

## Execution

Run the test with:

```bash
yarn test fork
```

## Test methodology

The test executes the following sequence:

1. **Initialization**:

   - Group creator (usually 'fabri') initializes and manages the test group
   - The group name is updated with current timestamp for identification
   - Creator sends an initial "start" message to confirm setup

2. **Message exchange**:

   - Selected test workers send messages with their identifier and iteration count

   ```typescript
   await sendMessageToGroup(
     currentWorker,
     globalGroup.id,
     `${currentWorker.name}:${i}`,
   );
   ```

3. **Membership manipulation**:

   - For each test worker, the creator performs multiple add/remove cycles:

   ```typescript
   await group.sync();
   await group.removeMembers([memberInboxId]);
   await group.sync();
   await group.addMembers([memberInboxId]);
   ```

4. **Fork verification**:

   - Non-test workers are mentioned to check response
   - A forked client will not see or respond to messages from clients in different branches

5. **Completion**:
   - The creator sends a final message to conclude the test
   - The test verifies message delivery across all participants

## Observed behavior

The test consistently demonstrates fork behavior patterns:

- **Coinbase Wallet** (build 99.1.0-oneoff-2hmgx / 999999): Forks consistently
- **Convos Messenger**: Forks less consistently but is reproducible
- **Web and Node SDK clients**: Less likely to experience forking during testing

In the forked state:

- Push notifications continue to reach Coinbase Wallet
- Clients in different branches cannot see each other's messages
- The fork persists until clients restart or resync

## Technical details

- **Performance correlation**: There appears to be a correlation between forking and SDK performance when client creation intervals approach 1 second

![Performance Correlation](https://github.com/user-attachments/assets/e3836192-1be5-44bf-8738-3b15a185b842)

## Testing the fork

To manually test for the presence of a fork after running the automated test:

1. Mention multiple workers in a single message:

```
hey bob alice dave joe
```

2. Observe the responses:
   - In a non-forked group, you'll receive responses from all mentioned workers
   - In a forked group, you'll only receive responses from workers in your branch
   - Clients in different branches will not see each other's response messages

## Setup instructions

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```
