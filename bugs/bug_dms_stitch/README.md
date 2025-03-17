# DM conversation stitch bug

## Summary

Bug where messages to the same recipient appear in different, unsynced DM conversations after client restart.

## Steps to reproduce

1. Set up:

```bash
git clone https://github.com/xmtp/xmtp-qa-testing/
cd xmtp-qa-testing
yarn
```

2. Configure `destinationInboxId` in `test.test.ts` with your test recipient's ID

3. Run first test:

```bash
yarn test bug_dms_stitch
```

- Creates DM and sends message
- Simulates client restart

4. Run test again:

```bash
yarn test bug_dms_stitch
```

- Creates new DM to same recipient
- Messages from first run don't appear in second conversation

## Actual behavior

- Browser doesn't show new messages but never shows duplicate conversations
- Convos list shows duplicates until is reopened, on refresh, only the old conversation is kept

## Files

- [Test code](./test.test.ts)
- [Environment data](/.data/)
- [Environment variables](/.env)
