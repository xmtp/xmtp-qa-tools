# Test bots

Test bots for the XMTP protocol that validate functionality, automate testing scenarios, and provide interactive agents for development.

## Quick reference

| Bot            | Purpose             | Key Features                                            |
| -------------- | ------------------- | ------------------------------------------------------- |
| **debug/**     | Debug information   | Detailed conversation analysis, member info, sync state |
| **echo/**      | Echo bot            | Simple message echo with prefix                         |
| **key-check/** | Key package checker | Check XMTP key package status, commands                 |

## Usage

```bash
# Run the debug bot
yarn bot debug --env dev

# Run the echo bot
yarn bot echo --env dev

# Run the key-check bot
yarn bot key-check

# Run the send test bot with 5 workers
yarn bot send 5
```

## Debug bot

Comprehensive debug information about XMTP conversations and messages.

```typescript
// Process incoming messages with detailed debug info
for await (const message of stream) {
  console.log("=== MESSAGE RECEIVED ===");
  console.log(`Content: ${message.content as string}`);
  console.log(`Sender InboxId: ${message.senderInboxId}`);

  // Get conversation debug info
  const debugInfo = await conversation.debugInfo();
  console.log(`Debug epoch: ${debugInfo.epoch}`);
  console.log(`Maybe forked: ${debugInfo.maybeForked}`);

  // Members info with addresses
  const members = await conversation.members();
  for (const member of members) {
    const memberAddress = await getSenderAddress(client, member.inboxId);
    console.log(`Member: ${memberAddress}`);
  }
}
```

Functions: Detailed message analysis, conversation state tracking, member information, sync state monitoring, group-specific details.

## Echo bot

Simple bot that echoes back messages with a prefix.

```typescript
// Process incoming messages and echo them back
for await (const message of stream) {
  console.log(
    `Received message: ${message.content as string} by ${message.senderInboxId}`,
  );
  await conversation.send(`echo: ${message.content as string}`);
}
```

Functions: Message echo, simple response testing, conversation validation.

## GM bot

Simple bot that responds with "gm" to any message.

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

Functions: Simple greeting response, deployable to custom ENS domains, minimal configuration, standalone operation.

## Key-check bot

Interactive bot for checking XMTP key package status with commands.

```typescript
// Available commands:
// /kc - Check key package status for the sender
// /kc inboxid <INBOX_ID> - Check key package status for a specific inbox ID
// /kc address <ADDRESS> - Check key package status for a specific address
// /kc groupid - Show the current conversation ID
// /kc members - List all members' inbox IDs in the current conversation
// /kc version - Show XMTP SDK version information
// /kc uptime - Show when the bot started and how long it has been running
// /kc debug - Show debug information for the key-check bot
// /kc help - Show this help message
```

Functions: Key package status checking, installation validation, address resolution, conversation diagnostics, uptime monitoring.

## Simple bot

Diagnostic information about the XMTP protocol.

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

Functions: Identity information, conversation details, protocol diagnostics, connection testing.

## send test bot

Load testing for XMTP groups and DMs.

```typescript
// Run send test with specified number of workers
const sendTest = async (count) => {
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

Functions: Configurable worker count, group creation testing, large group scale testing, performance benchmarking.

## Configuration

Environment variables:

```bash
XMTP_ENV=dev                    # Network: local, dev, production
LOGGING_LEVEL=off              # Logging: off, debug, info, warn, error
SLACK_BOT_TOKEN=xoxb-...       # Optional: Slack notifications
```

## Best practices

1. Set proper environment variables for network and logging
2. Add error reporting to catch and log failures
3. Close streams and clients properly when shutting down
4. Use appropriate wallet keys for different environments
5. Choose the appropriate XMTP network for testing

```bash
# Launch test environment
yarn bot gm-bot
```
