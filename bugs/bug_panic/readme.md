## Description

The error looks like this:

```
thread 'tokio-runtime-worker' panicked at /Users/runner/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/napi-2.16.16/src/threadsafe_function.rs:165:9:
Threadsafe Function release failed InvalidArg
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

```
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_messages.rs:211:73:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## How to replicate

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn test bug_panic
```

## Test code

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](./test.log) log

### Environment

- [./data](.data/) folder
- [.env](.env) file
