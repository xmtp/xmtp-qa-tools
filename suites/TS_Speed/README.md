# XMTP Speed Testing Suite (TS_Speed)

This test suite measures the response time from XMTP applications to gauge real-world user experience and application performance.

## Test Environment

- **Client**: Single worker "alice" as the test sender
- **Target**: Configurable target user (specified via environment variable)
- **Timeout**: 30-second timeout for response monitoring
- **Metrics**: Response time measurement in milliseconds

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
XMTP_ENV=production  # Options: production, dev
CB_USER=<target_user_inbox_id>  # Inbox ID of the target user/application to test
```

## Test Execution

```bash
yarn test ts_speed
```

## Test Flow

1. **Conversation Setup**:

   - Initializes a test worker ("alice")
   - Creates a new conversation with the target user

2. **Message Exchange**:

   - Sends a timestamped test message requesting a response
   - Starts timing upon message send
   - Listens for response in the conversation

3. **Response Measurement**:
   - Records and logs the time between message send and response receipt
   - Enforces a 30-second timeout for non-responsive applications
   - Outputs detailed timing information for analysis

## Performance Metrics

The test captures and reports:

- Response time in milliseconds
- Success/failure of response receipt
- Complete message content for verification

## Key Features Tested

- Real-world application response time
- End-to-end message delivery performance
- Application responsiveness under normal conditions
- Timeout handling for non-responsive applications

## Use Cases

This test is particularly useful for:

- Monitoring production application performance
- Comparing response times across different XMTP applications
- Establishing baseline performance expectations
- Detecting performance regressions in application updates
