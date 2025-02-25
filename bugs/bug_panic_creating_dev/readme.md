# Bug

**Description**: rust panic when creating groups stream_conversations.rs:346:5

## Error

A bug was discovered when creating installations in XMTP, which causes a panic leading to unexpected application behavior. This issue affects the installation process and may result in a crash or unintended termination.

```bash
thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:346:5:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Test

This test file measures how long it takes to create message groups with different numbers of people. It tests three group sizes:

1. Create a group with 5 people
2. Create a group with 15 people
3. Create a group with 25 people

For each test, the code:

1. Creates worker clients to represent different users
2. Records the time needed to create a group
3. Shows information about each group member
4. Checks that the group was created correctly

```tsx
it("Measure group creation time for 5 participants", async () => {
  const amount = 5;
  const allWorkers = await getWorkers(amount, env, testName);
  const workerArray = Object.values(allWorkers);

  console.time(`create group ${amount}`);
  const inboxIds = workerArray.slice(0, amount).map((p) => p.client!.inboxId);
  const group =
    await workerArray[0].client!.conversations.newGroupByInboxIds(inboxIds);
  console.timeEnd(`create group ${amount}`);
  const members = await group.members();
  for (const member of members) {
    const worker = workerArray.find(
      (w) => w.client!.inboxId === member.inboxId,
    );
    console.log(
      "name:",
      worker?.name,
      "installations:",
      member.installationIds.length,
    );
  }
  expect(group.id).toBeDefined();
});

it("Measure group creation time for 15 participants", async () => {
  const amount = 15;
  const allWorkers = await getWorkers(amount, env, testName);
  const workerArray = Object.values(allWorkers);

  console.time(`create group ${amount}`);
  const inboxIds = workerArray.slice(0, amount).map((p) => p.client!.inboxId);
  const group =
    await workerArray[0].client!.conversations.newGroupByInboxIds(inboxIds);
  console.timeEnd(`create group ${amount}`);
  const members = await group.members();
  for (const member of members) {
    const worker = workerArray.find(
      (w) => w.client!.inboxId === member.inboxId,
    );
    console.log(worker?.name, member.inboxId, member.installationIds.length);
  }
  expect(group.id).toBeDefined();
});
```

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](/test.log) log

### Environment

- [./data](./.data/) folder
- [.env](.env) file

## Running test

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn build
yarn test bug_panic_creating_dev
```
