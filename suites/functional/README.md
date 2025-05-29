# 🧪 XMTP Functional Tests

This directory contains functional tests for the XMTP protocol. These tests verify the core functionality of XMTP, including direct messages, group conversations, consent management, and more.

## Quick reference

| Module                    | Purpose                                 | Key Features                               |
| ------------------------- | --------------------------------------- | ------------------------------------------ |
| **browser.test.ts**       | Browser environment testing             | Web integration, UI interactions           |
| **clients.test.ts**       | Client initialization and configuration | Client creation, version testing           |
| **codec-error.test.ts**   | Content codec error handling            | Error recovery, malformed messages         |
| **consent.test.ts**       | User consent management                 | Allow/deny mechanisms, preferences         |
| **conversations.test.ts** | Conversation functionality              | Creation, listing, metadata                |
| **dms.test.ts**           | Direct message functionality            | DM creation, messaging, delivery           |
| **groups.test.ts**        | Group conversation functionality        | Group creation, updates, member management |
| **installations.test.ts** | Multi-device installation testing       | Cross-device sync, installation management |
| **metadata.test.ts**      | Conversation metadata handling          | Metadata updates, retrieval                |
| **offline.test.ts**       | Offline messaging capabilities          | Message queuing, synchronization           |
| **order.test.ts**         | Message ordering verification           | Sequencing, timestamps, delivery order     |
| **regression.test.ts**    | Regression issue prevention             | Historical bug verification, edge cases    |
| **streams.test.ts**       | Message streaming verification          | Stream performance, delivery confirmation  |
| **sync.test.ts**          | Synchronization methods comparison      | Performance benchmarking, sync strategies  |

## Usage

The functional tests are designed to be run with Vitest:

```bash
# Run all functional tests
yarn test functional

# Run a specific test file
yarn test functional/streams.test.ts

# Run tests with a specific tag
yarn test --grep "group"
```

## 🌐 Browser Testing

The `browser.test.ts` module tests XMTP in browser environments.

```typescript
// Create a new Playwright instance for browser testing
const xmtpPlaywright = new playwright(headless, env);

// Test group creation and messaging in browser
await xmtpPlaywright.createGroupAndReceiveGm(addresses);
```

**Key features:**

- Browser environment simulation
- Web UI interaction testing
- Cross-platform verification

## 👤 Client Management

The `clients.test.ts` module tests XMTP client initialization and configuration.

```typescript
// Test client creation with different versions
it("should create clients with different SDK versions", async () => {
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

## 🛡️ Codec Error Handling

The `codec-error.test.ts` module tests handling of content codec errors.

```typescript
// Test handling of malformed messages
it("should handle malformed content gracefully", async () => {
  // Test error recovery mechanisms
});
```

**Key features:**

- Error recovery testing
- Malformed message handling
- Content type validation

## 🔐 Consent Management

The `consent.test.ts` module tests user consent mechanisms.

```typescript
// Test consent management for conversations
it("should require consent for new conversations", async () => {
  const preferences = await client.preferences.inboxState();
  expect(preferences.consentState).toBeDefined();
});
```

**Key features:**

- Allow/deny mechanisms
- Consent preference persistence
- Contact blocking functionality

## 💬 Conversation Basics

The `conversations.test.ts` module tests basic conversation functionality.

```typescript
// Test conversation retrieval
it("should retrieve existing conversations", async () => {
  await client.conversations.sync();
  const conversations = await client.conversations.list();
  expect(conversations.length).toBeGreaterThan(0);
});
```

**Key features:**

- Conversation creation
- Conversation listing
- Metadata handling

## 📨 Direct Messaging

The `dms.test.ts` module tests direct messaging capabilities.

```typescript
// Test DM creation and sending
it("newDm: should create a direct message conversation", async () => {
  const convo = await client.conversations.newDm(recipientInboxId);
  expect(convo).toBeDefined();

  const message = "Hello XMTP!";
  const msgId = await convo.send(message);
  expect(msgId).toBeDefined();
});
```

**Key features:**

- DM conversation creation
- Message sending/receiving
- Delivery confirmation

## 👥 Group Conversations

The `groups.test.ts` module tests group conversation functionality.

```typescript
// Test group creation with multiple participants
it("createGroup: should create a group with participants", async () => {
  const group = await client.conversations.newGroup(participantInboxIds, {
    groupName: "Test Group",
  });
  expect(group.id).toBeDefined();

  // Test member management
  await group.addMembers([newMemberInboxId]);
  const members = await group.members();
  expect(members.length).toBe(participantInboxIds.length + 2); // +1 for creator, +1 for new member
});
```

**Key features:**

- Group creation and configuration
- Member management
- Admin privileges
- Group metadata updates

## 📱 Multi-device Installations

The `installations.test.ts` module tests multi-device synchronization.

```typescript
// Test installation synchronization
it("should sync conversations across installations", async () => {
  // Create a second installation for the same account
  const installation2 = await Client.create(signer, {
    dbEncryptionKey: encryptionKey,
    env: XMTP_ENV,
  });

  // Verify conversations sync between installations
  await client.conversations.sync();
  await installation2.conversations.sync();

  const conversations1 = await client.conversations.list();
  const conversations2 = await installation2.conversations.list();
  expect(conversations1.length).toBe(conversations2.length);
});
```

**Key features:**

- Cross-device synchronization
- Installation management
- Authentication across devices

## 📋 Metadata Handling

The `metadata.test.ts` module tests conversation metadata handling.

```typescript
// Test metadata updates and retrieval
it("should update and retrieve conversation metadata", async () => {
  await group.updateName("Updated Group Name");
  await group.sync();
  expect(group.name).toBe("Updated Group Name");
});
```

**Key features:**

- Metadata updates
- Retrieval mechanisms
- Change propagation

## 📵 Offline Capability

The `offline.test.ts` module tests offline message handling.

```typescript
// Test offline message handling
it("should sync messages received while offline", async () => {
  // Simulate offline by not syncing initially
  const message = "Offline test message";
  await senderClient.conversations.newDm(recipientInboxId).send(message);

  // Now sync to receive messages sent while "offline"
  await recipientClient.conversations.sync();
  const conversations = await recipientClient.conversations.list();
  const msgs = await conversations[0].messages();
  expect(msgs[0].content).toBe(message);
});
```

**Key features:**

- Offline message queuing
- Synchronization after reconnect
- Historical message retrieval

## 🔢 Message Ordering

The `order.test.ts` module tests message ordering and sequence verification.

```typescript
// Test message ordering
it("should deliver messages in the correct order", async () => {
  // Send multiple messages in sequence
  for (let i = 0; i < 10; i++) {
    await convo.send(`Message ${i}`);
  }

  // Verify messages are received in order
  await recipientClient.conversations.sync();
  const msgs = await recipientConvo.messages();
  for (let i = 0; i < 10; i++) {
    expect(msgs[i].content).toBe(`Message ${i}`);
  }
});
```

**Key features:**

- Sequence verification
- Timestamp ordering
- Delivery confirmation

## 🐛 Regression Testing

The `regression.test.ts` module verifies fixes for historical issues.

```typescript
// Test regression issues
it("should handle edge case that previously caused issues", async () => {
  // Test specific edge cases that were problematic in previous versions
});
```

**Key features:**

- Historical bug verification
- Edge case testing
- Version compatibility

## 🔄 Stream Testing

The `streams.test.ts` module tests message streaming functionality.

```typescript
// Test stream message delivery
it("receiveGM: should receive a message via stream", async () => {
  const convo = await client.conversations.newDm(recipientInboxId);
  const verifyResult = await verifyMessageStream(convo, [recipient]);
});
```

**Key features:**

- Real-time message streams
- Delivery verification
- Stream performance

## 🔄 Sync Comparison

The `sync.test.ts` module compares different synchronization approaches.

```typescript
// Compare different sync methods
it("should measure performance of sync methods", async () => {
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

## 📝 Best practices

When working with these functional tests, consider the following best practices:

1. **Test isolation:** Each test should be independent and not rely on state from other tests
2. **Error handling:** Use try/catch blocks with proper error logging
3. **Cleanup:** Always close clients and clean up resources in afterAll blocks
4. **Performance tracking:** Use performance measurements to track test execution time
5. **Logging:** Include appropriate logging for debugging test failures
