# Stitch test

## Purpose

Tests XMTP conversation stitching across client restarts and multiple instances.

## Run the test

```bash
yarn test bug_stitch
```

## Test flow

```typescript
// 1. Initialize first client
const workers = await getWorkers(
  ["ivy-a-202"],
  testName,
  typeofStream.Message,
  false,
  undefined,
  env,
);
ivy100 = workers.get("ivy", "a");

// 2. Create DM and send message
const newConvo = await sender.conversations.newDm(receiver);
await newConvo?.send("message 1/3");

// 3. Simulate restart
await ivy100?.worker.clearDB();
await ivy100?.worker.initialize();

// 4. Initialize second client
const workers = await getWorkers(
  ["ivy-b-105"],
  testName,
  typeofStream.Message,
  false,
  undefined,
  env,
);
ivy104 = workers.get("ivy", "b");
```

## Configuration

```typescript
const users = {
  xmtpchat: {
    inboxId: "519ba83d74dcede687258389e9950540ef5cec8200679d85a2f3cf16fdb97f2e",
    env: "dev",
  },
};
```
