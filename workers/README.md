# Worker Framework

## Basic Usage

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";

describe("test", async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupTestLifecycle({ testName });

  it("should work", async () => {
    const alice = workers.get("alice");
    const bob = workers.get("bob");
    const dm = await alice.client.conversations.newDm(bob.client.inboxId);
    await dm.send("Hello");
  });
});
```

## Worker Creation

```typescript
// Basic patterns
await getWorkers(3); // 3 random workers
await getWorkers(["alice", "bob"]); // specific names
await getWorkers(5, { env: "production" }); // production env
await getWorkers(3, { useVersions: true }); // random SDK versions
await getWorkers(1, { nodeVersion: "3.1.1" }); // specific version
```

## Conversations

```typescript
// DMs
const dm = await alice.client.conversations.newDm(bob.client.inboxId);
const dm2 = await alice.client.conversations.newDmWithIdentifier({
  identifier: bob.address,
  identifierKind: IdentifierKind.Ethereum,
});

// Groups
const group = await alice.client.conversations.newGroup([bob.client.inboxId]);
const testGroup = await workers.createGroupBetweenAll("My Group");

// Messages
await dm.send("Hello DM");
await group.send("Hello Group");
```

## Group Operations

```typescript
await group.updateName("New Name");
await group.addMembers([newMemberInboxId]);
await group.removeMembers([memberInboxId]);
await group.addAdmin(memberInboxId);
const members = await group.members();
```

## Streams

```typescript
// Start streams
worker.worker.startStream(typeofStream.Message);
worker.worker.startStream(typeofStream.MessageandResponse);

// Stop streams
worker.worker.endStream();
worker.worker.endStream(typeofStream.Message);

// Verify delivery
const result = await verifyMessageStream(
  conversation,
  [workers.get("bob")],
  1,
  "gm-{i}-{randomSuffix}",
);
expect(result.allReceived).toBe(true);
```

## Version Testing

```typescript
import { getVersions } from "@workers/versions";

// Random versions
const workers = await getWorkers(3, { useVersions: true });

// Specific versions
const versions = getVersions().slice(0, 3);
for (const version of versions) {
  const workers = await getWorkers([`bob-a-${version.nodeVersion}`], {
    useVersions: false,
  });
  // Test logic
}
```

## Worker Access

```typescript
const alice = workers.get("alice");
const bob = workers.get("bob");
workers.getCreator(); // First worker
workers.getReceiver(); // Random non-creator
workers.getAll(); // All workers array
workers.getRandomWorkers(2); // Random subset
```

## Key Imports

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { getVersions } from "@workers/versions";
import { IdentifierKind } from "@xmtp/node-sdk";
```
