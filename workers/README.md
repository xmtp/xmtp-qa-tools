# Testing Worker Framework Rules

## Core Testing Pattern

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, it } from "vitest";

describe("my-test", async () => {
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({ testName });

  it("should do something", async () => {
    // Test logic here
  });
});
```

## getWorkers API

The `getWorkers` function has three input modes with optional configuration:

### Input Modes

```typescript
// 1. Number - creates that many workers with random names (default)
const workers = await getWorkers(5);

// 2. Array of specific worker names
const workers = await getWorkers(["alice", "bob", "charlie"]);

// 3. Record for API URL mapping (for distributed testing)
const workers = await getWorkers({
  alice: "https://api1.example.com",
  bob: "https://api2.example.com",
});
```

### Options Configuration

```typescript
type GetWorkersOptions = {
  env?: XmtpEnv; // XMTP environment (default: from XMTP_ENV)
  nodeVersion?: string; // Specific SDK version to use
  useVersions?: boolean; // Apply random version descriptors (default: false)
  randomNames?: boolean; // Use random names for number input (default: true)
};

// Examples:
await getWorkers(3); // 3 workers with random names, latest version
await getWorkers(3, { randomNames: false }); // 3 workers with fixed names (bob, alice, fabri)
await getWorkers(["alice", "bob"]); // Specific names, latest version
await getWorkers(["alice", "bob"], { useVersions: true }); // Specific names, random versions
await getWorkers(1, { nodeVersion: "3.1.1" }); // Specific SDK version
await getWorkers(5, { env: "production" }); // 5 random workers on production
```

### Version Testing Patterns

#### Random Version Assignment (Multi-Version Testing)

```typescript
// Enable random version assignment across available SDK versions
const workers = await getWorkers(3, { useVersions: true });
// Creates workers with random versions like: alice-a-3.1.1, bob-a-2.2.1, charlie-a-3.0.1
```

#### Specific Version Testing

```typescript
// Test with a specific SDK version
const workers = await getWorkers(1, { nodeVersion: "3.1.1" });
// Creates: alice-3.1.1

// Regression testing across multiple specific versions
const versions = getVersions().slice(0, 3);
for (const version of versions) {
  const workers = await getWorkers([`bob-a-${version.nodeVersion}`], {
    useVersions: false, // Don't apply additional versioning
  });
  // Test logic for each version
}
```

#### Advanced Regression Testing

```typescript
import { getVersions } from "@workers/versions";

// Test downgrade scenarios
const versions = getVersions().slice(0, 3);
for (const version of versions) {
  const workers = await getWorkers([`bob-a-${version.nodeVersion}`], {
    useVersions: false,
  });
  const bob = workers.get("bob");
  console.log("Downgraded to SDK:", bob?.sdk);
  // Test logic here
}

// Test upgrade scenarios
for (const version of versions.reverse()) {
  const workers = await getWorkers([`alice-a-${version.nodeVersion}`], {
    useVersions: false,
  });
  const alice = workers.get("alice");
  console.log("Upgraded to SDK:", alice?.sdk);
  // Test logic here
}
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

## SDK Version Management

### Available Versions

```typescript
import { getVersions, VersionList } from "@workers/versions";

// Get all auto-enabled versions (used for random version assignment)
const autoVersions = getVersions();

// Access default SDK version
let defaultSdk = getVersions()[0].nodeVersion; // Currently "3.1.1"
```

### SDK Version Mappings

```typescript
export const VersionList = [
  {
    Client: Client310,
    Conversation: Conversation310,
    Dm: Dm310,
    Group: Group310,
    nodeVersion: "3.1.1",
    bindingsPackage: "1.2.7",
    auto: true, // Included in getVersions()
  },
  {
    Client: Client300,
    Conversation: Conversation300,
    Dm: Dm300,
    Group: Group300,
    nodeVersion: "3.0.1",
    bindingsPackage: "1.2.5",
    auto: true,
  },
  {
    Client: Client220,
    Conversation: Conversation220,
    Dm: Dm220,
    Group: Group220,
    nodeVersion: "2.2.1",
    bindingsPackage: "1.2.2",
    auto: true,
  },
  // ... additional versions with auto: true
];
```

### Environment Variable Control

```typescript
// Control version testing through environment variables
process.env.TEST_VERSIONS = "3"; // Use up to 3 random versions

// Use in tests
const testVersions = parseInt(process.env.TEST_VERSIONS ?? "1");
const availableVersions = getVersions().slice(0, testVersions);
```

## Common Usage Patterns

### Basic Testing (Latest Version)

```typescript
// Most common patterns - uses latest SDK version
const workers = await getWorkers(5); // 5 random workers
const workers = await getWorkers(["alice", "bob"]); // Specific workers
```

### Multi-Version Compatibility Testing

```typescript
// Random version assignment for compatibility testing
const workers = await getWorkers(3, { useVersions: true });
// Creates workers with different SDK versions automatically
```

### Regression Testing Across Versions

```typescript
// Test all available versions systematically
const versions = getVersions().slice(0, 3);
for (const version of versions) {
  it(`should work with SDK ${version.nodeVersion}`, async () => {
    const workers = await getWorkers([`alice-a-${version.nodeVersion}`], {
      useVersions: false,
    });
    // Test logic for specific version
  });
}
```

### Large Group Testing with Specific Version

```typescript
// Example from failtowait test - create large groups with specific SDK
const workers = await getWorkers(1, { nodeVersion: "3.1.1" });
const creator = workers.getAll()[0];

const memberInboxIds = getInboxIds(100);
const group = await creator.client.conversations.newGroup(memberInboxIds);
```

### Environment-Specific Testing

```typescript
const workers = await getWorkers(5, { env: "production" });
const workers = await getWorkers(["alice"], { env: "local" });
```

## Test Organization

- Use `useVersions: true` for multi-version compatibility testing
- Use `nodeVersion: "x.x.x"` for specific version testing
- Use `typeofStream.Message` for message streaming
- Always call `setupTestLifecycle({testName})` for proper cleanup
- Test file naming: `*.test.ts` in `suites/` directory

## Key Imports

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { getVersions, VersionList } from "@workers/versions";
import { IdentifierKind } from "@xmtp/node-sdk";
```
