# Fork Testing in XMTP

This test suite verifies XMTP group functionality with 12 clients to identify and reproduce forking issues.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

## Test Environment

- **8 Bots**: Running on the latest node-sdk version
- **4 Manual Clients**:
  - Convos.io
  - Convos Desktop
  - XMTP Chat Web
  - Coinbase Wallet (iOS build)

## Setup Instructions

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the `bugs/bug_fork` directory with the following parameters:

```bash
LOGGING_LEVEL="off"  # Options: debug, info, warn, error
XMTP_ENV="production"  # Options: production, dev

# InboxIDs for test participants
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

## Test Methodology

The test executes the following sequence:

1. **Initialization**:

   - Group creator updates the group name with the current timestamp
   - Creator sends an initial "start" message

2. **Message Exchange**:

   - Each worker sends a message with their identifier and iteration count:

   ```typescript
   await sendMessageToGroup(
     testConfig.workers[i],
     globalGroup.id,
     testConfig.workers[i].name + ":" + String(i),
   );
   ```

3. **Membership Manipulation**:

   - The creator performs multiple add/remove cycles for each participant:

   ```typescript
   // Perform add/remove cycles
   for (let i = 0; i <= trys; i++) {
     await group.removeMembers([memberInboxId]);
     await group.addMembers([memberInboxId]);
     console.warn(`Epoch ${i} done`);
   }
   ```

4. **Completion**:
   - The creator sends a final "Done" message to conclude the test

## Observed Behavior

- **Coinbase Wallet** (build 99.1.0-oneoff-2hmgx / 999999): Forks consistently
- **Convos Messenger**: Forks less consistently but is reproducible
- **Web and Node SDK clients**: Never experience forking during testing

In the forked state, push notifications continue to reach Coinbase Wallet.

## Testing the fork

To test the fork mention the workers like:

```
hi frank fabri dave grace eve
```

You should get a response from each of the workers.

## Technical Details

- Total SDK calls per test: 51 calls
  - Calculation: 1 + (1 + 1 + 1) + 1 + 3×(1 + 1 + 1) + 3×(1 + 1 + 1 + 6×2) + 1 = 51
  - Note: This may occasionally exceed API rate limits

## Observed Correlation

> There appears to be a correlation between forking and SDK performance when client creation intervals approach 1 second

![Performance Correlation](https://github.com/user-attachments/assets/e3836192-1be5-44bf-8738-3b15a185b842)
