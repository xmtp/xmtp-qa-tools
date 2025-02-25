# Bug panic creating

## Summary

A bug was discovered when creating installations in XMTP, which causes a panic leading to unexpected application behavior. This issue affects the installation process and may result in a crash or unintended termination.

```bash
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Steps to reproduce

1. Check out the logs [libxmtp](./libxmtp.logs)
2. Env file to reproduce
2. Observe the panic during the creation of installations.
3. Review the logs in libxmtp.logs and TS_Group_installations_dev.log for further details.

## Running test

```bash
yarn
yarn build
yarn test bug_panic_creating_dev
```
