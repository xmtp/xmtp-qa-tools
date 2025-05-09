# XMTP Notifications Testing Suite (TS_Notifications)

This test suite validates XMTP's notification functionality by sending randomized messages from multiple senders to a target recipient within a defined time period.

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the root directory:

```bash
LOGGING_LEVEL=info  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev

# Recipient InboxID
# Default: c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b
```

> [!TIP]
> To find your InboxID, message `key-check.eth` with `/kc address`

## Test Execution

```bash
yarn test ts_notifications
```

## Test Flow

1. **Initialize Senders**: Create worker clients for all senders
2. **Message Scheduling**: Schedule random-timed messages (between 0-30 seconds)
3. **DM Creation**: Each sender creates a direct message conversation with the recipient
4. **Message Sending**: Senders transmit numbered and timestamped messages
5. **Verification**: All messages are sent within the test duration

## Test Parameters

- **NUM_MESSAGES**: Number of total messages to send (default: 10)
- **TEST_DURATION**: Test time window in milliseconds (default: 30,000ms)
- **SENDER_WORKERS**: Array of worker names that act as message senders
- **receiverInboxId**: Target inbox that receives all notifications

This test simulates real-world notification patterns with unpredictable timing and multiple senders, helping validate notification delivery reliability and timing accuracy.
