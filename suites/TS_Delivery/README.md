# XMTP Message Delivery Testing Suite (TS_Delivery)

This test suite focuses on verifying message delivery reliability, ordering, and recovery capabilities in XMTP, providing metrics for delivery rates and message ordering.

## Test Environment

- **Clients**: Configurable number of workers for message sending and receiving
- **Message Volume**: Configurable batch size for message delivery testing
- **Test Types**: Stream-based delivery, polling-based delivery, and offline recovery

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the root directory with your testing configuration:

```bash
LOGGING_LEVEL=off  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev

# Delivery test configuration
DELIVERY_AMOUNT=10  # Number of messages to send
DELIVERY_RECEIVERS=4  # Number of receiver clients
```

## Test Execution

```bash
yarn test delivery
```

## Test Flow

1. **Group Setup**:

   - Creates workers based on the configured receiver count
   - Creates a new group with all workers as members

2. **Stream-based Message Testing**:

   - Sends a configurable number of messages to the group
   - Uses streams to verify message reception
   - Measures delivery rate and message order preservation

3. **Poll-based Message Testing**:

   - Verifies message reception using the conversation.messages() method
   - Compares results with stream-based reception
   - Measures delivery rate and message order preservation

4. **Offline Recovery Testing**:
   - Takes a client offline
   - Sends messages while the client is offline
   - Brings the client back online
   - Verifies that all messages are recovered

## Performance Metrics

The test records and reports multiple metrics to DataDog:

- **Delivery Rate**: Percentage of messages successfully delivered
- **Order Preservation**: Percentage of messages received in the correct order
- **Recovery Efficiency**: Success rate of message recovery after disconnection

## Key Features Tested

- Message delivery reliability across multiple receivers
- Message ordering preservation
- Offline message recovery
- Comparison between streaming and polling message reception methods
- SDK version impact on delivery performance
