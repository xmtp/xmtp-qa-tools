# XMTP Testing Worker Framework Rules

## Core Testing Pattern

```typescript
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "my-test";

describe(testName, async () => {
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({});

  it("should do something", async () => {
    try {
      // Test logic here
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
```

## Dynamic Stream Control

Workers now support dynamic stream control, allowing you to start and stop specific stream types during runtime:

### Starting Streams

```typescript
// Start a message stream
worker.worker.startStream(typeofStream.Message);

// Start a message stream with automatic responses
worker.worker.startStream(typeofStream.MessageandResponse);

// Start multiple streams
worker.worker.startStream(typeofStream.Conversation);
worker.worker.startStream(typeofStream.Consent);
```

### Stopping Streams

```typescript
// Stop all streams
worker.worker.endStream();

// Stop a specific stream type
worker.worker.endStream(typeofStream.Message);
```

## Worker Access Patterns

```typescript
// Get specific workers
const alice = workers.get("alice");
const bob = workers.get("bob");

// Access worker properties
alice.client; // XMTP client
alice.worker; // Worker thread
alice.name; // "alice"
alice.address; // Ethereum address
alice.client.inboxId; // Inbox ID

// Utility methods
workers.getCreator(); // First worker
workers.getReceiver(); // Random non-creator
workers.getAll(); // All workers array
workers.getAllButCreator(); // All except first
workers.getRandomWorkers(2); // Random subset
```

## Conversation Operations

```typescript
// Create DM by inbox ID
const dm = await alice.client.conversations.newDm(bob.client.inboxId);

// Create DM by Ethereum address
const dm2 = await alice.client.conversations.newDmWithIdentifier({
  identifier: bob.address,
  identifierKind: IdentifierKind.Ethereum,
});

// Create group with inbox IDs
const group = await alice.client.conversations.newGroup([
  bob.client.inboxId,
  workers.get("charlie").client.inboxId,
]);

// Create group between all workers
const testGroup = await workers.createGroupBetweenAll("My Group");

// Send messages
await dm.send("Hello DM");
await group.send("Hello Group");
```

## Group Operations

```typescript
// Group metadata
await group.updateName("New Name");
await group.updateDescription("New Description");

// Member management
await group.addMembers([newMemberInboxId]);
await group.removeMembers([memberInboxId]);

// Admin management
await group.addAdmin(memberInboxId);
await group.addSuperAdmin(memberInboxId);

// Get group info
const members = await group.members();
const name = group.name;
const admins = group.admins;
```

## Stream Verification

```typescript
// Verify message delivery
const verifyResult = await verifyMessageStream(
  conversation,
  [workers.get("bob")], // receivers
  1, // message count
  "gm-{i}-{randomSuffix}", // message template
);
expect(verifyResult.allReceived).toBe(true);

// Other stream verifications
await verifyMetadataStream(group, receivers, count);
await verifyMembershipStream(group, receivers, membersToAdd);
await verifyConversationStream(initiator, receivers);
```

## Available Worker Names

Use predefined names from the 61 available:

```typescript
["bob", "alice", "fabri", "elon", "joe", "charlie", "dave", "eve",
 "frank", "grace", "henry", "ivy", "jack", "karen", "larry", "mary",
 "nancy", "oscar", "paul", "quinn", "rachel", "steve", "tom", "ursula",
 "victor", "wendy", "xavier", "yolanda", "zack", ...]
```

## Error Handling

Always wrap test logic in try-catch:

```typescript
try {
  // Test operations
} catch (e) {
  logError(e, expect.getState().currentTestName);
  throw e;
}
```

## Test Organization

- Use `getWorkersWithVersions()` for version testing
- Use `typeofStream.Message` for message streaming
- Always call `setupTestLifecycle({})` for proper cleanup
- Test file naming: `*.test.ts` in `suites/` directory

## Key Imports

```typescript
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
```
