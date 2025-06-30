# 🤖 Workers for Testing

> Internal testing utilities for simulating multi-user and multi-device scenarios

## 🌟 Overview

Our testing framework provides worker utilities that allow you to easily create predefined workers (like Alice, Bob, etc.) with different installations. This is particularly useful for testing multi-device scenarios or different client configurations within our test suite.

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

- **🔑 Identity Management**: Automatic key creation with persistence between test runs
- **📱 Multi-Device Testing**: Simulate multiple installations (desktop, mobile, etc.) for the same worker
- **📊 Separate Storage**: Independent database paths for each installation
- **🔄 Stream Handling**: Built-in support for message, conversation, and consent streams
- **🤖 GPT Integration**: Optional AI-powered responses for automated testing scenarios

## 📋 Usage Examples

### Basic Testing

```typescript
// Import the getWorkers function
import { getWorkers } from "./path/to/manager";

// Initialize workers in your test file
const workers = await getWorkers(["alice", "bob"], testName);

// Access workers by name (default installation "a")
const alice = workers.get("alice");
const bob = workers.get("bob");

// Test a simple conversation
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
await conversation.send("Hello Bob!");

// Wait for Bob to receive the message
await bob.client.conversations.sync();
const bobConversations = await bob.client.conversations.list();
```

### Multi-Device Scenarios

```typescript
// Create primary and secondary installations
const primaryWorkers = await getWorkers(["alice", "bob"], testName);
const secondaryWorkers = await getWorkers(
  ["alice-desktop", "bob-mobile"],
  testName,
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
await alicePhone.client.conversations.sync();
const alicePhoneConversations = await alicePhone.client.conversations.list();
```

### Stream Collection

```typescript
// Set up worker with message streaming
const workers = await getWorkers(["alice", "bob"], testName);
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
);

console.log(`Received message: ${incomingMessages[0].message.content}`);
```

### Using GPT Responses

```typescript
// Create workers with GPT-powered responses
const workers = await getWorkers(
  ["alice", "bob"],
  testName,
  typeofStream.Message,
  typeOfResponse.Gpt,
);
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
```

### Creating Multiple Workers at Once

```typescript
// Create 4 workers using default names
const workers = await getWorkers(4, testName);
// This will create workers for the first 4 names in defaultNames
```

## 🧰 Available Methods

| Method                                                        | Description                              |
| ------------------------------------------------------------- | ---------------------------------------- |
| `getWorkers(descriptors, testName, streamType?, gptEnabled?)` | Creates and initializes worker instances |
| `workers.get(name, installationId?)`                          | Retrieves a specific worker              |
| `workers.getCreator()`                                        | Returns the worker creator               |
| `workers.getAll()`                                            | Returns all workers                      |
| `workers.createGroupBetweenAll(groupName, workerNames)`       | Creates a group of workers               |
| `workers.getLength()`                                         | Returns the total number of workers      |
| `workers.getRandomWorkers(count)`                             | Gets a random subset of workers          |

## 📚 Available names for workers

The framework comes with 61 predefined worker names that you can use:

```typescript
import { defaultNames } from "@xmtp/node-sdk";

// First few names from the list:
// "bob", "alice", "fabri", "bot", "elon", "joe", "charlie"...
```

> 💡 **Tip**: Access our repository of 600 dummy wallets with inboxIds in the `inboxes.json` file

## 🧹 Cleanup

Always clean up your workers after tests:

```typescript
afterAll(async () => {
  await closeEnv(testName, allWorkers);
});
```

## 🔍 Implementation Details

- Worker instances use Node.js worker threads for parallel processing
- Keys are stored in `.env` files (except for "random" workers which store keys only in memory)
- Database paths follow a structured format to avoid conflicts between tests
- Message streams, conversation streams, and consent streams are supported
- GPT responses are generated using OpenAI's API if enabled

# Worker Manager

This package provides a robust framework for managing XMTP workers with support for multiple stream types and dynamic stream control.

## Features

- Multi-device simulation with separate installations
- Dynamic stream control - start and stop specific stream types at runtime
- Support for different stream types: Messages, Group Updates, Conversations, Consent
- Automatic key generation and persistence
- Built-in message collection and verification

## Stream Control

Workers now support dynamic stream control, allowing you to start and stop specific stream types during runtime:

### Starting Streams

```typescript
import { typeofStream } from "@workers/main";

// Start a message stream
worker.worker.startStream(typeofStream.Message);

// Start a group update stream
worker.worker.startStream(typeofStream.GroupUpdated);

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

### Example Usage

```typescript
import { getWorkers } from "@workers/manager";
import { typeofStream } from "@workers/main";

const testName = "stream-control-test";

describe("Dynamic Stream Control", async () => {
  // Create workers without any initial streams
  const workers = await getWorkers(["alice", "bob"], testName, typeofStream.None);
  
  it("should control streams dynamically", async () => {
    const alice = workers.get("alice");
    const bob = workers.get("bob");
    
    // Start message streams for both workers
    alice.worker.startStream(typeofStream.Message);
    bob.worker.startStream(typeofStream.Message);
    
    // Create a group and send messages
    const group = await alice.client.conversations.newGroup([bob.client.inboxId]);
    await group.send("Hello!");
    
    // Collect messages
    const messages = await bob.worker.collectMessages(group.id, 1);
    expect(messages).toHaveLength(1);
    
    // Stop message streams and start conversation streams
    alice.worker.endStream(typeofStream.Message);
    bob.worker.endStream(typeofStream.Message);
    
    alice.worker.startStream(typeofStream.Conversation);
    bob.worker.startStream(typeofStream.Conversation);
    
    // Now test conversation creation...
  });
});
```

## Stream Types

The available stream types are:

- `typeofStream.Message` - Regular text messages, reactions, and replies
- `typeofStream.GroupUpdated` - Group metadata changes and member updates  
- `typeofStream.Conversation` - New conversation creation events
- `typeofStream.Consent` - Consent state changes
- `typeofStream.None` - No streams (useful for initialization)

## Benefits of Dynamic Stream Control

1. **Resource Efficiency**: Only run streams when needed
2. **Test Isolation**: Start/stop streams for specific test scenarios
3. **Multiple Stream Types**: Run different stream types simultaneously
4. **Better Debugging**: Control exactly which events are being monitored

## Usage Examples

### Testing Message Delivery
```typescript
// Start only message streams for delivery test
alice.worker.startStream(typeofStream.Message);
bob.worker.startStream(typeofStream.Message);

// Test message delivery
// ...

// Clean up
alice.worker.endStream();
bob.worker.endStream();
```

### Testing Group Management
```typescript
// Start group update streams for membership changes
alice.worker.startStream(typeofStream.GroupUpdated);
bob.worker.startStream(typeofStream.GroupUpdated);

// Test group operations
// ...

// Stop when done
alice.worker.endStream(typeofStream.GroupUpdated);
bob.worker.endStream(typeofStream.GroupUpdated);
```
