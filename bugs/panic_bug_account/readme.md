# Bug

**Description**: error creating a DM with this account

```bash
WALLET_KEY_BUG=0xed8abf6c3222b6483f6f55971754cacd7370438b776048cd84b84f5dae0683bc
ENCRYPTION_KEY_BUG=d7df4be2c5a77c8fe6034f76137b470f997757e5d5b237dfe49f0d66a14d8185
#public 0xc9925662D36DE3e1bF0fD64e779B2e5F0Aead964
```

With ocationals panics

```bash
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Test code

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](/test.log) log

### Environment

- [./data](./.data/) folder
- [.env](./.env) file

## Running test

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn build
yarn test panic_bug_account_dev
```
