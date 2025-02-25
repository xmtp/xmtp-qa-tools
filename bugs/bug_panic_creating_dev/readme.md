# Bug panic creating

## Error

A bug was discovered when creating installations in XMTP, which causes a panic leading to unexpected application behavior. This issue affects the installation process and may result in a crash or unintended termination.

```bash
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Reproduce

### Test

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](/test.log) log

### Environment

- [./data](./.data) folder
- [env](./env.example) file

## Running test

```bash
yarn
yarn build
yarn test bug_panic_creating_dev
```
