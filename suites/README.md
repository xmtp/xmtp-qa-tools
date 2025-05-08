# 🧪 XMTP Test Suites

This directory contains end-to-end test suites for validating the XMTP protocol functionality, performance, and reliability. Each suite focuses on a specific aspect of the protocol, providing comprehensive verification of the system's capabilities.

## Quick reference

| Suite                | Purpose                              | Key Features                                  |
| -------------------- | ------------------------------------ | --------------------------------------------- |
| **TS_AgentHealth**   | Agent responsiveness monitoring      | Production bot health checks, uptime tracking |
| **TS_Delivery**      | Message delivery reliability testing | Delivery verification, group message testing  |
| **TS_Fork**          | Fork detection and resolution        | Fork tolerance, conflict resolution           |
| **TS_Gm**            | Basic messaging functionality        | Core protocol verification, simple messages   |
| **TS_Notifications** | Push notification validation         | Multi-sender scenarios, notification timing   |
| **TS_Performance**   | Protocol performance measurement     | Operation benchmarking, scalability testing   |
| **TS_Stress**        | System load and capacity testing     | Group scaling, high message volume testing    |

## Usage

You can run these test suites using yarn commands:

```bash
# Run all test suites
yarn test

# Run a specific test suite
yarn test ts_performance

# Run with specific configuration
BATCH_SIZE=10 MAX_GROUP_SIZE=20 yarn test ts_performance

# Run multiple suites
yarn test "ts_delivery|ts_gm"
```

## 🤖 Agent Health

The `TS_AgentHealth` suite monitors the health and responsiveness of production XMTP agents.

```typescript
// Test agent responsiveness
it(`should test ${agent.name} agent health check`, async () => {
  const dm = await client.conversations.newDmWithIdentifier({
    identifier: agent.address,
    identifierKind: IdentifierKind.Ethereum,
  });

  await dm.send(agent.sendMessage);
  const success = await waitForResponse(dm, agent.expectedMessage);
  expect(success).toBe(true);
});
```

**Key features:**

- Production agent monitoring
- Response time measurement
- Health status reporting
- Command verification

## 📬 Delivery Verification

The `TS_Delivery` suite verifies reliable message delivery across network conditions.

```typescript
// Verify message delivery in groups
it("should verify message delivery in a group", async () => {
  const group = await creator.client.conversations.newGroup(
    participants.map((p) => p.client.inboxId),
  );

  const result = await verifyMessageStreamAll(group, workers);
  expect(result.allReceived).toBe(true);
});
```

**Key features:**

- Message delivery confirmation
- Group delivery verification
- Delivery timing metrics
- Network resilience testing

## 🍴 Fork Management

The `TS_Fork` suite tests the system's ability to handle conversation forks.

```typescript
// Test fork resolution
it("should detect and resolve forked conversations", async () => {
  // Create fork condition by sending parallel messages
  await Promise.all([
    client1.conversations.newDm(receiverInboxId).send("Fork 1"),
    client2.conversations.newDm(receiverInboxId).send("Fork 2"),
  ]);

  await receiverClient.conversations.sync();
  const conversations = await receiverClient.conversations.list();

  // Verify we don't have duplicated conversations
  const uniqueConversationIds = new Set(conversations.map((c) => c.id));
  expect(uniqueConversationIds.size).toBe(conversations.length);
});
```

**Key features:**

- Fork detection
- Conflict resolution
- Data consistency verification
- Recovery testing

## 👋 GM Testing

The `TS_Gm` suite verifies basic messaging functionality with simple "gm" tests.

```typescript
// Test basic messaging
it("should send and receive gm message", async () => {
  const dm = await client.conversations.newDm(receiverInboxId);
  await dm.send("gm");

  const verifyResult = await verifyMessageStream(dm, [receiver]);
});
```

**Key features:**

- Basic protocol verification
- Simple messaging tests
- Core functionality validation
- Protocol compatibility testing

## 🔔 Notifications

The `TS_Notifications` suite validates notification delivery and timing.

```typescript
// Test notifications from multiple senders
it("should deliver notifications from multiple senders", async () => {
  // Schedule random-timed messages from multiple senders
  for (let i = 0; i < NUM_MESSAGES; i++) {
    const sender = senders[Math.floor(Math.random() * senders.length)];
    const delay = Math.random() * TEST_DURATION;

    setTimeout(async () => {
      const dm = await sender.client.conversations.newDm(receiverInboxId);
      await dm.send(`Message ${i} at ${Date.now()}`);
    }, delay);
  }

  // Verify all messages are received
  await sleep(TEST_DURATION + 1000);
  await receiver.client.conversations.sync();

  // Count received messages
  const conversations = await receiver.client.conversations.list();
  const messageCount = await countMessages(conversations);

  expect(messageCount).toBeGreaterThanOrEqual(NUM_MESSAGES);
});
```

**Key features:**

- Multi-sender scenarios
- Randomized message timing
- Notification reliability testing
- Delivery timing verification

## ⚡ Performance

The `TS_Performance` suite measures protocol performance metrics.

```typescript
// Measure group creation with increasing sizes
for (let i = batchSize; i <= total; i += batchSize) {
  it(`createGroup-${i}: should create a group with ${i} participants`, async () => {
    const sliced = generatedInboxes.slice(0, i);
    const group = await client.conversations.newGroup(
      sliced.map((inbox) => inbox.inboxId),
    );
    expect(group.id).toBeDefined();
  });
}
```

**Key features:**

- Operation timing metrics
- Scalability testing
- Performance benchmarking
- Resource utilization measurement

## 🔥 Stress Testing

The `TS_Stress` suite conducts load testing to verify system stability.

```typescript
// Test large group message broadcasting
it("should handle message broadcast to large groups", async () => {
  const largeGroup = await client.conversations.newGroup(
    allMembers.map((m) => m.inboxId),
  );

  // Send multiple messages in rapid succession
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await largeGroup.send(`Stress test message ${i}`);
  }

  // Verify delivery to all members
  const result = await verifyMessageStreamAll(largeGroup, workers);
  expect(result.allReceived).toBe(true);
});
```

**Key features:**

- Large group testing
- High volume message testing
- System stability verification
- Resource limit testing

## 📝 Test Configuration

Most test suites can be configured using environment variables:

```bash
# Performance testing configuration
BATCH_SIZE=5        # Group member batch size
MAX_GROUP_SIZE=50   # Maximum group size to test
XMTP_ENV=dev        # XMTP network environment

# General test configuration
LOGGING_LEVEL=info  # Logging verbosity
TEST_DURATION=30000 # Test duration in milliseconds
```

## 📊 Monitoring and Reporting

Test results are automatically reported to monitoring systems:

1. **Console Output**: Detailed test results in the terminal
2. **Datadog Metrics**: Performance metrics sent to dashboards
3. **CI/CD Integration**: Test results in GitHub Actions workflows

## 📝 Best practices

When working with these test suites, consider the following best practices:

1. **Environment setup**: Configure proper test environment variables
2. **Test isolation**: Run tests in clean environments to avoid state interference
3. **Performance testing**: Run performance tests on standardized hardware for consistent results
4. **Result verification**: Check both success/failure status and performance metrics
5. **Resource cleanup**: Ensure tests clean up resources even when they fail
