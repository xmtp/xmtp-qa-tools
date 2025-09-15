# UX Demo Bot

A simple XMTP bot that demonstrates core content types for UX testing and development.

## Features

This bot showcases the following XMTP content types:

### Content Types

- **Text Messages** 📝 - Basic text communication
- **Reactions** 👍 - Emoji reactions to messages
- **Replies** 💬 - Threaded message replies

### Interactive Features

- Simple command interface
- Real-time message handling
- Content type demonstrations

## Usage

### Starting the Bot

```bash
yarn bot ux
```

### Commands

The bot responds to the following text commands:

#### Text Commands

- `/help` - Show help menu with all available commands
- `/reaction` - Send a reaction to your message
- `/reply` - Send a reply to your message
- `/demo` - Run all demo types in sequence (text, reply, reaction)

#### Example Usage

1. Send any message to the bot
2. Try `/reaction` to see a reaction added to your message
3. Try `/reply` to see a reply to your message
4. Try `/demo` to see all content types demonstrated in sequence

## Implementation Details

### Dependencies

- `@xmtp/agent-sdk` - Core XMTP agent functionality
- `@xmtp/content-type-reaction` - Reaction content type
- `@xmtp/content-type-reply` - Reply content type

### Configuration

Set environment variables in `.env`:

- `XMTP_ENV` - XMTP network (local/dev/production)

### Architecture

- **Message Store**: Tracks message IDs for replies/reactions
- **Event Handlers**: Process different message types (text, reaction, reply)
- **Command Processing**: Simple text-based command interface

## Development

This bot serves as a reference implementation for:

- Basic content type support
- Simple UX patterns
- Message handling workflows

Use this bot to test XMTP client implementations and basic UX flows.
