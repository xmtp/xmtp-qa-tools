# Stitch test

## Purpose

Tests XMTP conversation stitching across client restarts and multiple instances.

## Run the test

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install

yarn test bug_stitch
```

## Test flow

```typescript
// 1. Initialize first client
const workers = await getWorkers(["ivy-a-202"], env);
ivy100 = workers.get("ivy", "a");
ivy100?.worker.startStream(typeofStream.Message);

// 2. Create DM and send message
const newConvo = await sender.conversations.newDm(receiver);
await newConvo?.send("message 1/3");

// 3. Simulate restart
await ivy100?.worker.clearDB();
await ivy100?.worker.initialize();

// 4. Initialize second client
const workers2 = await getWorkers(["ivy-b-105"], env);
ivy104 = workers2.get("ivy", "b");
ivy104?.worker.startStream(typeofStream.Message);
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
