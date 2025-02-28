## Test agent

This agent performs a series of commands to interact with conversations using the XMTP protocol. It can sync conversations, create groups, and respond to messages.

### Usage

- Replies with a "gm" message to any message

- Command: `/group`

- Creates a group and sends a message with the group details.
- Names the group with the format `group-YYYY-MM-DD`.
- Adds members to the group by inbox id
- Sends random messages from each member

## Running bot

```bash
git clone https://github.com/ephemeraHQ/qa-testing/
cd qa-testing
yarn
yarn bot test
```
