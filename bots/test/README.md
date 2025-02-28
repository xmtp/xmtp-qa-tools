## Test agent

This agent performs a series of commands to interact with conversations using the XMTP protocol. It can sync conversations, create groups, and respond to messages.

### Usage

- Replies with a "gm" message to any message

- Command: `/group`

- Creates a group and sends a message with the group details.
- Names the group with the format `group-YYYY-MM-DD`.
- Adds a description with the same format as the group name.
- Sends a message with the group ID, group URL, and other details.

## Running bot

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn bot test
```
