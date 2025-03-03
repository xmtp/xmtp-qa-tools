## Description

We found an account that causes several problems

1. Creates key package errors when used with agents
2. Makes groups stop working when added as a member
3. Does not get conversations during basic message tests
4. Causes the program to crash

The error looks like this:

```
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
```

## Account details

```
WALLET_KEY_BUG=0xed8abf6c3222b6483f6f55971754cacd7370438b776048cd84b84f5dae0683bc
ENCRYPTION_KEY_BUG=d7df4be2c5a77c8fe6034f76137b470f997757e5d5b237dfe49f0d66a14d8185
Public address: 0xc9925662D36DE3e1bF0fD64e779B2e5F0Aead964
```

## Problems this causes

This issue creates these problems:

- Groups stop working when this account is added
- Direct messages with this account do not work well
- The application sometimes crashes
- Agents cannot work with this account

## How to replicate

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn test panic_bug_account
```

## Test code

- Test [code](https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account/test.test.ts)

### Logs

- [libxmtp](https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account/libxmtp.log) log
- [test logs](https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account/test.log) log

### Environment

- [./data](https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account/.data/) folder
- [.env](https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account/.env) file

## More information

- All test code and logs are here: https://github.com/ephemeraHQ/qa-testing/tree/main/bugs/panic_bug_account
