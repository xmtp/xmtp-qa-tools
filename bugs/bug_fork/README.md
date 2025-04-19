# Chaos fork testing in XMTP

This test is designed to test the robustness of the XMTP group protocol under various failure conditions.

```bash
#XMTP
LOGGING_LEVEL="debug"
XMTP_ENV="production"

USER_CONVOS=""
USER_CB_WALLET=""
USER_XMTPCHAT=""
USER_CONVOS_DESKTOP="ca727d8cd02271a0dab564d6be9be6254fb103bb0bcbfdec660d39f4bc16671"
```

Group ID

```bash
GROUP_ID="the group will be set here for reutilization"
```

Run the test with the fix flag to recover forked users from the group

```bash
npm run test -- --fix
```
