# XMTP Message Delivery Testing Suite (m_delivery)

This test suite focuses on verifying message delivery reliability, ordering, and recovery capabilities in XMTP, providing metrics for delivery rates and message ordering.

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Test Execution

```bash
yarn test m_delivery
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
