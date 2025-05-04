# Gated Group Bot

This agent adds users to a private group chat when they message a passphrase.

When a user sends a DM to the agent:

1. The agent welcomes them and asks for a passphrase
2. If the user sends the correct passphrase (configured as `GROUP_CODE`)
3. The agent adds them to a specific group (configured with `GROUP_ID`)
4. The agent sends a confirmation message

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
GROUP_CODE= # passphrase used to grant access
GROUP_ID_PROD= # ID of the group to add users to in production
GROUP_ID_DEV= # ID of the group to add users to in dev
```

### Run the agent

```bash
git clone https://github.com/ephemerahq/csx-concierge.git
cd csx-concierge
yarn install
yarn dev
```
