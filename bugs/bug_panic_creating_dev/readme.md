# Bug panic creating

## Summary

A bug was discovered when creating installations in XMTP, which causes a panic leading to unexpected application behavior. This issue affects the installation process and may result in a crash or unintended termination.

```bash
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Steps to reproduce

1. Run the test TS_Create_Installations.test.ts.
2. Observe the panic during the creation of installations.
3. Review the logs in libxmtp.logs and TS_Group_installations_dev.log for further details.

## Expected behavior

The installation process should complete without triggering a panic and handle errors gracefully.

## Additional logs

Refer to the log files in this directory for more context on the error occurrence.

## Notes

This bug is tracked under the code @bug_panic_creating.
