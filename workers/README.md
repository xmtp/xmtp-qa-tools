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
