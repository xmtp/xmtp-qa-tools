# Test Bots

Test bots for the XMTP protocol that validate functionality, automate testing scenarios, and provide interactive agents for development.

## Quick Reference

| Bot         | Purpose             | Key Features                            |
| ----------- | ------------------- | --------------------------------------- |
| **gm-bot/** | Simple greeting bot | Basic response, standalone deployment   |
| **simple/** | Diagnostics bot     | Identity info, conversation details     |
| **stress/** | Load testing bot    | Group scaling, performance benchmarking |

## Usage

```bash
# Run the GM bot
yarn bot gm-bot

# Run the stress test bot with 5 workers
yarn bot stress 5

# Run the simple diagnostics bot
yarn bot simple
```

## GM Bot

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

## Simple Bot

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

## Stress Test Bot

Load testing for XMTP groups and DMs.

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

Functions: Configurable worker count, group creation testing, large group scale testing, performance benchmarking.

## Configuration

Environment variables:

```bash
XMTP_ENV=dev                    # Network: local, dev, production
LOGGING_LEVEL=off              # Logging: off, debug, info, warn, error
SLACK_BOT_TOKEN=xoxb-...       # Optional: Slack notifications
SLACK_CHANNEL=C...             # Optional: Slack channel
```

## Best Practices

1. Set proper environment variables for network and logging
2. Add error reporting to catch and log failures
3. Close streams and clients properly when shutting down
4. Use appropriate wallet keys for different environments
5. Choose the appropriate XMTP network for testing

```bash
# Launch test environment
yarn bot gm-bot
```
