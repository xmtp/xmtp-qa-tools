# XMTP Test Bots

This directory contains test bots for the XMTP protocol. These bots help validate the functionality of XMTP, automate testing scenarios, and provide interactive agents for development purposes.

## Quick reference

| Bot         | Purpose                     | Key Features                             |
| ----------- | --------------------------- | ---------------------------------------- |
| **bots/**   | AI-powered personality bots | GPT integration, persistent identities   |
| **gm-bot/** | Simple greeting bot         | Basic response, standalone deployment    |
| **simple/** | Diagnostics bot             | Identity info, conversation details      |
| **stress/** | Load testing bot            | Group scaling, performance benchmarking  |
| **test/**   | Command-based testing bot   | Test automation, conversation management |

## Usage

You can run these bots using the yarn commands defined in package.json:

```bash
# Run the GM bot
yarn bot gm

# Run the stress test bot
yarn bot stress

# Run the test bot with command interface
yarn bot test

# Run the simple bot
yarn bot simple

# Run the agents bot
yarn bot agents
```

## 🧠 AI Agents

The `agents` bot provides AI-powered chat personalities using GPT integration.

```typescript
// Initialize multiple agent personalities
const workersGpt = await getWorkers(["sam", "tina", "walt"]);

// Start message streams with GPT responses on demand
workersGpt.getAll().forEach((worker) => {
  worker.worker.startStream(typeofStream.MessageandResponse);
});
```

**Key features:**

- Persistent GPT-powered personalities
- Multiple character identities
- Natural language interaction
- Automatic message streaming

## 👋 GM Bot

The `gm-bot` is a simple bot that responds with "gm" to any message it receives.

```typescript
// Process incoming messages
for await (const message of stream) {
  if (message.senderInboxId === client.inboxId) continue;

  // Reply with "gm" to any incoming message
  const conversation = await client.conversations.getConversationById(
    message.conversationId,
  );
  await conversation.send("gm");
}
```

**Key features:**

- Simple greeting response
- Deployable to custom ENS domains
- Minimal configuration
- Standalone operation

## 🔍 Simple Bot

The `simple` bot provides diagnostic information about the XMTP protocol.

```typescript
// Process incoming messages and provide diagnostic info
for await (const message of stream) {
  const conversation = await client.conversations.getConversationById(
    message.conversationId,
  );

  // Send back diagnostic information
  await conversation.send(`address: ${addressFromInboxId}`);
  await conversation.send(`inboxId: ${message.senderInboxId}`);
  await conversation.send(`conversationId: ${conversation.id}`);
}
```

**Key features:**

- Identity information
- Conversation details
- Protocol diagnostics
- Connection testing

## 🔥 Stress Test Bot

The `stress` bot performs load testing for XMTP groups and DMs.

```typescript
// Run stress test with specified number of workers
const stressTest = async (count) => {
  const workers = await getWorkers(count);

  // Create group with all workers
  const group = await client.conversations.newGroup(
    workers.map((w) => w.client.inboxId),
  );

  // Send test messages to the group
  for (let i = 0; i < 5; i++) {
    await group.send(`Test message ${i}`);
  }
};
```

**Key features:**

- Configurable worker count
- Group creation testing
- Large group scale testing
- Performance benchmarking

## Test Bot

The `test` bot provides a command interface for testing XMTP features.

```typescript
// Process commands from incoming messages
async function processCommand(message, conversation) {
  const content = message.content as string;

  if (!content.startsWith("/")) return;

  const [command, ...args] = content.substring(1).split(" ");

  switch (command) {
    case "create":
      await createTestGroup(client, args[0] || "5");
      break;
    case "members":
      await listGroupMembers(conversation);
      break;
    // ...more commands
  }
}
```

**Key features:**

- Command-based interface
- Group management
- Conversation testing
- Member management
- Broadcasting capabilities

## 📝 Best practices

When using these test bots, consider the following best practices:

1. **Environment configuration:** Set proper environment variables for network and logging
2. **Error handling:** Add error reporting to catch and log failures
3. **Resource management:** Close streams and clients properly when shutting down
4. **Identity management:** Use appropriate wallet keys for different environments
5. **Network selection:** Choose the appropriate XMTP network (dev, production) for testing

```bash
# Launch test environment
yarn bot gm
```
