# 🧪 XMTP Functional Tests

This directory contains functional tests for the XMTP protocol. These tests verify the core functionality of XMTP, including direct messages, group conversations, consent management, and more.

## 📋 Test Modules

| Module                                        | Purpose                                            |
| --------------------------------------------- | -------------------------------------------------- |
| [browser.test.ts](#browsertestts)             | Tests integration with browser environments        |
| [clients.test.ts](#clientstestts)             | Tests client initialization and configuration      |
| [consent.test.ts](#consenttestts)             | Tests user consent management for conversations    |
| [conversations.test.ts](#conversationstestts) | Tests basic conversation functionality             |
| [dms.test.ts](#dmstestts)                     | Tests direct message creation and delivery         |
| [forked.test.ts](#forkedtestts)               | Tests handling of forked conversations             |
| [groups.test.ts](#groupstestts)               | Tests group conversation creation and management   |
| [installations.test.ts](#installationstestts) | Tests multi-device installations                   |
| [metadata.test.ts](#metadatatestts)           | Tests conversation metadata handling               |
| [offline.test.ts](#offlinetestts)             | Tests offline message handling and synchronization |
| [order.test.ts](#ordertestts)                 | Tests message ordering and delivery sequence       |
| [regression.test.ts](#regressiontestts)       | Tests to catch and prevent regression issues       |

## 🔍 Module Details

### browser.test.ts

Tests integration with browser environments and web applications:

```typescript
// Tests browser-specific functionality
it("should initialize client in browser environment", async () => {
  // Test browser integration
});
```

### clients.test.ts

Tests XMTP client initialization, configuration, and management:

```typescript
// Create and configure clients
it("should create a client with custom configuration", async () => {
  const client = await Client.create(signer, encryptionKey, { env });
  expect(client).toBeDefined();
});
```

### consent.test.ts

Tests user consent management for conversations:

```typescript
// Test allowing and denying conversation requests
it("should require consent for new conversations", async () => {
  // Test consent workflows
});
```

### conversations.test.ts

Tests basic conversation functionality:

```typescript
// Test conversation creation and retrieval
it("should retrieve existing conversations", async () => {
  await client.conversations.sync();
  const conversations = await client.conversations.list();
  expect(conversations.length).toBeGreaterThan(0);
});
```

### dms.test.ts

Tests direct message creation, delivery, and reception:

```typescript
// Test DM creation and message sending
it("newDm: should measure creating a DM", async () => {
  const convo = await client.conversations.newDm(recipientInboxId);
  expect(convo).toBeDefined();
});

it("sendGM: should measure sending a gm", async () => {
  const message = "gm-" + Math.random().toString(36).substring(2, 15);
  const dmId = await convo.send(message);
  expect(dmId).toBeDefined();
});
```

### forked.test.ts

Tests handling of forked conversations and conflict resolution:

```typescript
// Test forked conversation handling
it("should handle forked conversations", async () => {
  // Test fork detection and resolution
});
```

### groups.test.ts

Tests group conversation creation, management, and message delivery:

```typescript
// Test group creation with multiple participants
it("createGroup: should create a large group of participants", async () => {
  const newGroup = await client.conversations.newGroup(participantInboxIds);
  expect(newGroup.id).toBeDefined();
});

// Test group name updates
it("updateGroupName: should update the group name", async () => {
  const newName = "Large Group";
  await group.updateName(newName);
  await group.sync();
  expect(group.name).toBe(newName);
});
```

### installations.test.ts

Tests multi-device installations and synchronization:

```typescript
// Test installation synchronization
it("should sync conversations across multiple installations", async () => {
  // Test multi-device installations
});
```

### metadata.test.ts

Tests conversation metadata handling and updates:

```typescript
// Test metadata updates
it("should update and retrieve conversation metadata", async () => {
  // Test metadata operations
});
```

### offline.test.ts

Tests offline message handling and synchronization:

```typescript
// Test offline message handling
it("should sync messages received while offline", async () => {
  // Test offline synchronization
});
```

### order.test.ts

Tests message ordering and delivery sequence:

```typescript
// Test message ordering
it("should deliver messages in the correct order", async () => {
  // Test message sequence
});
```

### regression.test.ts

Tests to catch and prevent regression issues:

```typescript
// Test specific regression issues
it("should handle previously fixed issues correctly", async () => {
  // Test regression fixes
});
```
