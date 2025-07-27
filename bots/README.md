# Test bots

Test bots for the XMTP protocol that validate functionality, automate testing scenarios, and provide interactive agents for development.

## Quick reference

| Bot            | Purpose             | Key Features                            |
| -------------- | ------------------- | --------------------------------------- |
| **echo/**      | Echo bot            | Simple message echo with prefix         |
| **key-check/** | Key package checker | Check XMTP key package status, commands |

## Usage

```bash
# Run the echo bot
yarn bot echo --env dev

# Run the key-check bot
yarn bot key-check
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
