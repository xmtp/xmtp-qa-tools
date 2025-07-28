# Functional testing suite

This test suite validates core XMTP protocol functionality including direct messages, group conversations, consent management, and message delivery systems.

## What it does (units)

- Test DM conversation creation and message delivery
- Validate group conversation functionality and member management
- message streaming and syncs performance
- Test multi-device installation and cross-device sync
- Validate consent management and content codec handling

## Environment setup

Set `XMTP_ENV` to either `dev` or `production` to test against the corresponding network.

## Quick reference

| Module                    | Purpose                                 | Key Features                               |
| ------------------------- | --------------------------------------- | ------------------------------------------ |
| **clients.test.ts**       | Client initialization and configuration | Client creation, version testing           |
| **convos.test.ts**        | Conversation creation and management    | DM creation, group creation, messaging     |
| **debug.test.ts**         | Group debug information and state       | Epoch tracking, fork detection             |
| **installations.test.ts** | Multi-device installation testing       | Cross-device sync, installation management |
| **metadata.test.ts**      | Conversation metadata handling          | Metadata updates, retrieval                |
| **permissions.test.ts**   | Group permission management             | Admin roles, super admin, member control   |
| **streams.test.ts**       | Message streaming verification          | Stream performance, delivery confirmation  |
| **sync.test.ts**          | syncs methods comparison                | Performance benchmarking, sync strategies  |

## How to run

### Run all functional tests

```bash
yarn test functional
```

### Run specific test files

```bash
yarn test functional/dms.test.ts
yarn test functional/groups.test.ts
yarn test functional/streams.test.ts
```

## Client management

The `clients.test.ts` module tests XMTP client initialization and configuration.

```typescript
// Test client creation with different versions
it("create clients with different SDK versions", async () => {
  const client = await Client.create(signer, {
    dbEncryptionKey: encryptionKey,
    env: XMTP_ENV,
  });
  expect(client.inboxId).toBeDefined();
});
```

**Key features:**

- Client creation testing
- Configuration options verification
- Environment-specific behavior

## Conversation basics

The `convos.test.ts` module tests conversation creation and management functionality.

```typescript
// Test DM creation using inbox ID
it("newDm:create a new DM conversation using inbox ID", async () => {
  const convo = await workers
    .get("henry")!
    .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);
  expect(convo).toBeDefined();
  expect(convo.id).toBeDefined();
});

// Test DM creation using Ethereum address
it("newDmByAddress:create a new DM conversation using Ethereum address", async () => {
  const dm2 = await workers
    .get("henry")!
    .client.conversations.newDmWithIdentifier({
      identifier: workers.get("randomguy2")!.address,
      identifierKind: IdentifierKind.Ethereum,
    });
  expect(dm2).toBeDefined();
  expect(dm2.id).toBeDefined();
});
```

**Key features:**

- DM conversation creation by inbox ID
- DM conversation creation by Ethereum address
- Message sending and delivery verification
- Group creation with variable participant counts
- Group syncs and member verification

## Multi-device installations

The `installations.test.ts` module tests multi-device syncs.

```typescript
// Test installation syncs
it("sync conversations across installations", async () => {
  // Create a second installation for the same account
  const installation2 = await Client.create(signer, {
    dbEncryptionKey: encryptionKey,
    env: XMTP_ENV,
  });

  // conversations sync between installations
  await client.conversations.sync();
  await installation2.conversations.sync();

  const conversations1 = await client.conversations.list();
  const conversations2 = await installation2.conversations.list();
  expect(conversations1.length).toBe(conversations2.length);
});
```

**Key features:**

- Cross-device syncs
- Installation management
- Authentication across devices

## Metadata handling

The `metadata.test.ts` module tests conversation metadata handling.

```typescript
// Test metadata updates and retrieval
it("update and retrieve conversation metadata", async () => {
  await group.updateName("Updated Group Name");
  await group.sync();
  expect(group.name).toBe("Updated Group Name");
});
```

**Key features:**

- Metadata updates
- Retrieval mechanisms
- Change propagation

## Permission management

The `permissions.test.ts` module tests group permission and role management.

```typescript
// Test admin permission management
it("add and remove admin permissions", async () => {
  const member = workers.getReceiver();

  // Initially should not be admin
  expect(group.isAdmin(member.client.inboxId)).toBe(false);
  expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

  // Add as admin
  await group.addAdmin(member.client.inboxId);
  expect(group.isAdmin(member.client.inboxId)).toBe(true);
  expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);

  // Remove admin
  await group.removeAdmin(member.client.inboxId);
  expect(group.isAdmin(member.client.inboxId)).toBe(false);
});

// Test super admin permissions
it("add and remove super admin permissions", async () => {
  const member = workers.getReceiver();

  await group.addSuperAdmin(member.client.inboxId);
  expect(group.isSuperAdmin(member.client.inboxId)).toBe(true);
  expect(group.isAdmin(member.client.inboxId)).toBe(false);

  await group.removeSuperAdmin(member.client.inboxId);
  expect(group.isSuperAdmin(member.client.inboxId)).toBe(false);
});
```

**Key features:**

- Admin role assignment and removal
- Super admin permission management
- Admin list verification and management
- Member removal permissions
- Hierarchical permission structure

## Stream testing

The `streams.test.ts` module tests message streaming functionality.

```typescript
// Test stream message delivery
it("receiveGM:receive a message via stream", async () => {
  const convo = await client.conversations.newDm(recipientInboxId);
  const verifyResult = await verifyMessageStream(convo, [recipient]);
});
```

**Key features:**

- Real-time message streams
- Delivery verification
- Stream performance

## Debug information

The `debug.test.ts` module tests group debug information and state tracking.

```typescript
// Test debug info retrieval
it("debug: retrieve group debug information", async () => {
  const debugInfo = await group.debugInfo();
  expect(debugInfo).toBeDefined();
  expect(debugInfo.epoch).toBeDefined();
  expect(typeof debugInfo.epoch).toBe("bigint");
  expect(debugInfo.epoch).toBeGreaterThan(0n);
  expect(debugInfo.maybeForked).toBeDefined();
  expect(typeof debugInfo.maybeForked).toBe("boolean");
});

// Test epoch tracking during operations
it("debug: track epoch changes during group operations", async () => {
  const initialDebugInfo = await group.debugInfo();
  const initialEpoch = initialDebugInfo.epoch;

  await group.addMembers([newMember]);
  const updatedDebugInfo = await group.debugInfo();
  const updatedEpoch = updatedDebugInfo.epoch;

  expect(updatedEpoch).toBe(initialEpoch + 1n);
});
```

**Key features:**

- Group debug information retrieval
- Epoch tracking and consistency verification
- Fork detection and state validation
- Debug info structure completeness validation

## Sync comparison

The `sync.test.ts` module compares different syncs approaches.

```typescript
// Compare different sync methods
it("measure performance of sync methods", async () => {
  // Test client.conversations.sync()
  const syncStartTime = performance.now();
  await client.conversations.sync();
  const syncTime = performance.now() - syncStartTime;
  console.log(`Time to sync all conversations: ${syncTime}ms`);

  // Test individual conversation sync
  const convoSyncStart = performance.now();
  await conversation.sync();
  const convoSyncTime = performance.now() - convoSyncStart;
  console.log(`Time to sync single conversation: ${convoSyncTime}ms`);
});
```

**Key features:**

- Performance benchmarking
- Sync strategy comparison
- Optimization guidance

## Best practices

When working with these functional tests, consider the following best practices:

1. **Test isolation:** Each test should be independent and not rely on state from other tests
2. **Error handling:** Use try/catch blocks with proper error logging
3. **Cleanup:** Always close clients and clean up resources in afterAll blocks
4. **Performance tracking:** Use performance measurements to track test execution time
5. **Logging:** Include appropriate logging for debugging test failures
