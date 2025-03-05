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

````
2025-03-05T19:33:26.442925Z DEBUG tower::buffer::worker: buffer closing; waking pending tasks
2025-03-05T19:33:26.442964Z DEBUG tower::buffer::worker: buffer closing; waking pending tasks
2025-03-05T19:33:26.443041Z DEBUG tower::buffer::worker: buffer closing; waking pending tasks
2025-03-05T19:33:26.443054Z DEBUG tower::buffer::worker: buffer closing; waking pending tasks
2025-03-05T19:33:26.443159Z  INFO process:create_from_welcome: xmtp_mls::storage::encrypted_store::group: Trying to insert group
2025-03-05T19:33:26.443364Z  INFO process:create_from_welcome: xmtp_mls::storage::encrypted_store::group: Group is inserted
2025-03-05T19:33:26.443973Z DEBUG process:create_from_welcome: xmtp_mls::storage::encrypted_store: Transaction being committed
2025-03-05T19:33:26.444324Z DEBUG xmtp_mls::subscriptions::stream_conversations: finished processing with group 8648c89e2d32e2bf70f0e0fa05da3996 group_id="8648c89e2d32e2bf70f0e0fa05da3996"
2025-03-05T19:33:26.444328Z DEBUG xmtp_mls::subscriptions::stream_messages: begin establishing new message stream to include group_id=8648c89e2d32e2bf70f0e0fa05da3996 inbox_id="6c33260c83bab9645bb99ae8ba816f7f081cd853f25f5332cab589725192b576" installation_id=81fdf3eb63ff8e2e710d5ec40665f12ba08ae6b6bab61d48e868da92f3095341 group_id="8648c89e2d32e2bf70f0e0fa05da3996"
2025-03-05T19:33:26.444478Z DEBUG xmtp_api::mls: subscribing to group messages inbox_id="6c33260c83bab9645bb99ae8ba816f7f081cd853f25f5332cab589725192b576"

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
````

## Test code

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](./test.log) log

### Environment

- [./data](.data/) folder
- [.env](.env) file
