# Chaos fork testing in XMTP

This test is designed to test the robustness of the XMTP group protocol under various failure conditions.

```bash
#XMTP
LOGGING_LEVEL="debug"
XMTP_ENV="production"

USER_CONVOS=""
USER_CB_WALLET=""
USER_XMTPCHAT=""
USER_CONVOS_DESKTOP=""
```

> To learn your inboxID, send a message to `key-check.eth` or `0x235017975ed5F55e23a71979697Cd67DcAE614Fa`

Group ID

```bash
GROUP_ID="the group will be set here for reutilization"
```

Run the test with the fix flag to recover forked users from the group

```bash
npm run test -- --fix
```
