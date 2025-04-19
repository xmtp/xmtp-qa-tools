# Chaos fork testing in XMTP

This test is designed to test the robustness of the XMTP group protocol under various failure conditions.

```bash
#XMTP
LOGGING_LEVEL="debug"
XMTP_ENV="production"

USER_CONVOS="83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208"
USER_CB_WALLET="705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff"
USER_XMTPCHAT="5d14144ea9bf00296919cf6a3d6bd7ea9b53138ebe177108a35b0ab9ac00900e"
```

Group ID

```bash
GROUP_ID="the group will be set here for reutilization"
```

Run the test with the fix flag to recover forked users from the group

```bash
npm run test -- --fix
```
