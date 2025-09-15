# Key Check Agent with UX Demo

This comprehensive agent provides key package validation, fork detection, and UX message type demonstrations all in one bot.

## Commands

Once the agent is running, you can interact with it using the following commands:

### Key Package Checks

- `/kc` - Check key package status for the sender
- `/kc inboxid <INBOX_ID>` - Check key package status for a specific inbox ID
- `/kc address <ADDRESS>` - Check key package status for a specific address

### Conversation Analysis

- `/kc groupid` - Show the current conversation ID
- `/kc members` - List all members' inbox IDs in the current conversation
- `/kc fork` - **NEW!** Detect potential conversation forks and show detailed debug info

### Bot Information

- `/kc version` - Show XMTP SDK version information
- `/kc uptime` - Show when the bot started and how long it has been running
- `/kc debug` - Show debug information for the key-check bot
- `/kc help` - Show the help message with available commands

### UX Demo Commands

- `/kc ux` - Send one of each message type (comprehensive demo)
- `/kc ux-reaction` - Send a reaction to the last message
- `/kc ux-reply` - Send a reply to the last message
- `/kc ux-attachment` - Show attachment implementation demo
- `/kc ux-text` - Send a regular text message
