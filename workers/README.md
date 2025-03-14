# 🤖 Worker Testing Framework

> A powerful testing framework for creating and managing predefined personas with different client installations

[![Tests Status](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/yourusername/worker-testing-framework)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌟 Overview

The Worker Testing Framework allows you to easily simulate multiple users with different device installations for testing multi-device scenarios or different client configurations. Each worker represents a specific persona (like Alice, Bob, etc.) and can maintain separate installations while sharing the same identity.

```typescript
// Quick example
const workers = await getWorkers(["alice", "bob"], "my-test");
const alice = workers.get("alice");
const bob = workers.get("bob");

// Start a conversation
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
await conversation.send("Hello from Alice to Bob");
```

## ✨ Key Features

- **🔑 Identity Management**: Automatic key creation for new personas, with persistence for reuse
- **📱 Multi-Device Testing**: Simulate multiple installations (desktop, mobile, etc.) for the same persona
- **📊 Separate Storage**: Independent database paths for each installation
- **🔄 Stream Handling**: Built-in support for message, conversation, and consent streams
- **🤖 GPT Integration**: Optional AI-powered responses for automated testing scenarios
- **🧪 Event Collection**: Utilities for collecting and filtering stream events

## 🚀 Installation

```bash
npm install worker-testing-framework
```

## 📋 Usage Examples

### Basic Setup

```typescript
// Initialize workers
const workers = await getWorkers(["alice", "bob"], "conversation-test");

// Access workers by name (default installation "a")
const alice = workers.get("alice");
const bob = workers.get("bob");

// Test a simple conversation
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
await conversation.send("Hello Bob!");

// Wait for Bob to receive the message
await bob.client.conversations.syncAll();
const bobConversations = await bob.client.conversations.list();
```

### Multi-Device Scenarios

```typescript
// Create primary and secondary installations
const primaryWorkers = await getWorkers(["alice", "bob"], "multi-device-test");
const secondaryWorkers = await getWorkers(
  ["alice-desktop", "bob-mobile"],
  "multi-device-test",
);

// Access specific installations
const alicePhone = primaryWorkers.get("alice");
const aliceDesktop = secondaryWorkers.get("alice", "desktop");
const bobMobile = secondaryWorkers.get("bob", "mobile");

// Test synchronization across devices
const conversation = await aliceDesktop.client.conversations.newDm(
  bobMobile.client.inboxId,
);
await conversation.send("Hello from Alice's desktop!");

// Verify message appears on Alice's phone
await alicePhone.client.conversations.syncAll();
const alicePhoneConversations = await alicePhone.client.conversations.list();
```

### Stream Collection

```typescript
// Set up worker with message streaming
const workers = await getWorkers(["alice", "bob"], "stream-test", "message");
const alice = workers.get("alice");
const bob = workers.get("bob");

// Start conversation and send message
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
const conversationId = conversation.id;
await conversation.send("Testing stream collection");

// Collect incoming messages for Bob
const incomingMessages = await bob.worker.collectMessages(
  conversationId,
  "text",
  1, // number of messages to collect
  5000, // timeout in ms
);

console.log(`Received message: ${incomingMessages[0].message.content}`);
```

### Using the GPT Integration

```typescript
// Create workers with GPT-powered responses
const workers = await getWorkers(["alice", "bob"], "gpt-test", "message", true);
const alice = workers.get("alice");
const bob = workers.get("bob");

// Send message that will trigger GPT response from Bob
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
await conversation.send("Hey bob, what do you think about this feature?");

// Bob will automatically generate and send a response
// Wait for the response to come back to Alice
const responses = await alice.worker.collectMessages(
  conversation.id,
  "text",
  1,
);

console.log(`Bob's response: ${responses[0].message.content}`);
```

## 🧰 API Reference

### Main Functions

| Function                                                      | Description                              |
| ------------------------------------------------------------- | ---------------------------------------- |
| `getWorkers(descriptors, testName, streamType?, gptEnabled?)` | Creates and initializes worker instances |
| `worker.get(name, installationId?)`                           | Retrieves a specific worker              |
| `worker.collectMessages(groupId, typeId, count, timeout?)`    | Collects message stream events           |
| `worker.collectConversations(fromPeer, count?, timeout?)`     | Collects conversation stream events      |
| `worker.collectConsentUpdates(count?, timeout?)`              | Collects consent stream events           |

### Worker Properties

| Property                | Description                         |
| ----------------------- | ----------------------------------- |
| `worker.client`         | The XMTP client instance            |
| `worker.address`        | Wallet address of the worker        |
| `worker.dbPath`         | Database path for this installation |
| `worker.installationId` | Unique ID for this installation     |

## 📚 Available Default Personas

```typescript
const defaultNames = [
  "alice",
  "bob",
  "charlie",
  "dave",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary" /* ... */,
];
```

> 💡 **Tip**: Access our repository of 600 dummy wallets with inboxIds in the `generated-inboxes.json` file

## 🧹 Cleanup

Always clean up your workers after tests to properly release resources:

```typescript
afterAll(async () => {
  await workers.terminate();
});
```
