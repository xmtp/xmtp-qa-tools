# Fork testing in XMTP

This test is designed to test the XMTP groups with 12 clients.

https://github.com/user-attachments/assets/e4842b28-e1c4-4a6c-87ac-2e11651b2939

## Setup

- 8 bots (running on latest node-sdk version)
- 4 manual users (convos io, convos desktop, xmtpchat web and CB build IOS)

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Environment variables

Create a `.env` file in the `bugs/bug_fork` directory and set the following variables:

```bash
LOGGING_LEVEL="off" # debug, info, warn, error
XMTP_ENV="production" # production, dev

USER_CONVOS="" # InboxID
USER_CB_WALLET="" # InboxID
USER_XMTPCHAT="" # InboxID
USER_CONVOS_DESKTOP="" # InboxID
```

> [!TIP]
> To learn your inboxID, send a message to `key-check.eth` or `0x235017975ed5F55e23a71979697Cd67DcAE614Fa`
> Send `/kc address` to get your address and inbox ID

```bash
GROUP_ID="" # the group will be set here for reutilization
```

## Run the test

```bash
yarn test fork
```

## Test logic

The test executes the following sequence:

1. Group creator updates the group name with the current timestamp and sends a start message

2. Each worker sends a message with their name and iteration count

```typescript
await sendMessageToGroup(
  testConfig.workers[i],
  globalGroup.id,
  testConfig.workers[i].name + ":" + String(i),
);
```

3. The creator performs multiple add/remove cycles for each worker

```typescript
// Perform add/remove cycles
for (let i = 0; i <= trys; i++) {
  await group.removeMembers([memberInboxId]);
  await group.addMembers([memberInboxId]);
  console.warn(`Epoch ${i} done`);
}
```

4. The creator sends a final "Done" message to complete the test.

## Other considerations

- Coinbase Wallet build 99.1.0-oneoff-2hmgx (999999) forks consistently
- Convos Messenger (8) forks less consistently but reproducible
- The fork occurs when executing a sequence of 12 operations: multiple add/remove cycles in groups combined with message sending from different clients
- Web and Node SDK clients never get forked during testing
- In the forked state, push notifications still come through to Coinbase Wallet
- Total SDK calls = 1 + (1 + 1 + 1) + 1 + 3×(1 + 1 + 1) + 3×(1 + 1 + 1 + 6×2) + 1 = 51 calls
  - Some times hitting API limits
