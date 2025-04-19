# Fork testing in XMTP

This test is designed to test the XMTP groups with 12 clients.

- 8 bots (running on latest node-sdk version)
- 4 manual users (convos io, convos desktop, xmtpchat web and CB build IOS)

## Setup

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

> To learn your inboxID, send a message to `key-check.eth` or `0x235017975ed5F55e23a71979697Cd67DcAE614Fa`

Group ID

```bash
GROUP_ID="" # the group will be set here for reutilization
```
