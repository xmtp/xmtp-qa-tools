## Test agent

This agent performs a series of commands to interact with conversations using the XMTP protocol. It can sync conversations, create groups, and respond to messages.

## Basic usage

### Environment Variables

- `WALLET_KEY_BOT`: Must be set for the bot to function.
- `ENCRYPTION_KEY_BOT`: Must be set for the bot to function.
- `XMTP_ENV`: Specifies the XMTP environment.

### Messages

- Replies with a "gm" message to any message

### Commands

`/group`

- Creates a group and sends a message with the group details.
- Names the group with the format `group-YYYY-MM-DD`.
- Adds a description with the same format as the group name.
- Sends a message with the group ID, group URL, and other details.
