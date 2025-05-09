# XMTP GM Bot Testing Suite (TS_Gm)

This test suite verifies the functionality and responsiveness of the XMTP GM bot in different conversation types, including both direct messages and groups.

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Test Execution

```bash
yarn test ts_gm
```

## Test Flow

1. **Direct Message Testing**:

   - Creates a new DM conversation with the GM bot
   - Sends a simple "gm" message
   - Verifies that the bot responds correctly within a reasonable timeframe

2. **Deep Link Testing**:

   - Uses Playwright to test the web client interface
   - Creates a new conversation with the GM bot via deep link
   - Verifies successful creation of the conversation

3. **Group Conversation Testing**:
   - Creates a new group with the GM bot and several generated addresses
   - Sends messages to the group
   - Verifies the GM bot responds in the group context

## Performance Metrics

- Bot response time in direct messages
- Bot response time in group contexts
- Web client interaction performance
- End-to-end conversation creation time

## Key Features Tested

- Bot responsiveness in direct messages
- Bot responsiveness in group conversations
- Bot discovery and conversation initiation via deep links
- Message delivery and response timing
- UI interaction via automated browser testing

## Dependencies

- **XmtpPlaywright**: Helper class for UI testing of XMTP interfaces
- **Generated Inboxes**: Pre-generated testing accounts for group creation
