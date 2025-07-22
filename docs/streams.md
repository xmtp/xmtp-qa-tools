# Streams

Real-time message streams are a big part of what makes XMTP feel responsive to users. We test these pretty heavily to make sure messages arrive reliably, in the right order, and fast enough that conversations feel natural.

## What we test with streams

We validate that real-time message delivery works properly, messages show up in the right order, and performance is good enough for real users across different environments and group sizes.

## Test categories

### Reliability testing

```bash
# Stream delivery reliability
yarn test streams:delivery --duration=300s --message-count=100

# Stream recovery after interruption
yarn test streams:recovery --interruption-type=network

# Cross-environment stream testing
yarn test streams:cross-env --source=dev --target=production
```

### Order validation

```bash
# Message ordering accuracy
yarn test streams:order --concurrent-senders=5 --messages-per-sender=20

# Large group ordering
yarn test streams:order-large --group-size=100 --message-burst=50
```

### Performance benchmarks

```bash
# Stream response time testing
yarn test streams:performance --group-sizes=10,50,100,200

# Throughput testing
yarn test streams:throughput --messages-per-second=100
```

## Stream reliability metrics

### Delivery rate targets

Here's how we're doing on getting messages delivered reliably based on group size:

| Group size | Target delivery rate | Current performance | Status |
|------------|---------------------|-------------------|--------|
| 2-10 members | 99.9% | 100% | On target |
| 11-50 members | 99.5% | 99.8% | On target |
| 51-100 members | 99% | 99.2% | On target |
| 101-250 members | 98% | 97.5% | Concern |
| 251-400 members | 95% | 93.2% | Failed |

### Order accuracy metrics

| Test scenario | Target order rate | Current performance | Status |
|---------------|------------------|-------------------|--------|
| Single sender | 100% | 100% | On target |
| Multiple senders | 99.9% | 99.7% | On target |
| Burst messages | 99% | 98.9% | On target |
| Large groups | 98% | 96.8% | Concern |

## Stream performance characteristics

### Response time analysis

```typescript
// Stream response time measurement
describe('Stream response times', () => {
  test('message stream latency under load', async () => {
    const group = await createGroup(50);
    const startTime = Date.now();
    
    // Send message and measure stream delivery time
    await group.send('Performance test message');
    
    const streamResponses = await Promise.all(
      group.members.map(member => 
        waitForStreamMessage(member, 'Performance test message')
      )
    );
    
    const responseTime = Date.now() - startTime;
    await submitMetric('xmtp.stream.response_time', responseTime, {
      group_size: 50,
      test_type: 'performance'
    });
  });
});
```

### Throughput benchmarks

| Group size | Messages/second | P95 latency | P99 latency |
|------------|----------------|-------------|-------------|
| 10 members | 45 | 131ms | 245ms |
| 50 members | 38 | 234ms | 456ms |
| 100 members | 31 | 387ms | 672ms |
| 200 members | 22 | 589ms | 934ms |
| 400 members | 15 | 823ms | 1247ms |

## Stream testing scenarios

### Basic stream functionality

```typescript
describe('Basic stream functionality', () => {
  test('conversation stream delivers messages', async () => {
    const [sender, receiver] = await createClients(2);
    const conversation = await sender.conversations.newConversation(receiver.address);
    
    // Start message stream
    const messagePromise = waitForStreamMessage(receiver, 'Test message');
    
    // Send message
    await conversation.send('Test message');
    
    // Verify stream delivery
    const streamedMessage = await messagePromise;
    expect(streamedMessage.content).toBe('Test message');
  });
});
```

### Group stream testing

```typescript
describe('Group stream functionality', () => {
  test('group message streams to all members', async () => {
    const groupSize = 20;
    const admin = await createClient();
    const members = await createClients(groupSize - 1);
    
    const group = await admin.conversations.newGroup(
      members.map(m => m.address)
    );
    
    // Setup stream listeners for all members
    const streamPromises = members.map(member =>
      waitForGroupMessage(member, group.id, 'Group stream test')
    );
    
    // Send message to group
    await group.send('Group stream test');
    
    // Verify all members receive via stream
    const results = await Promise.allSettled(streamPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const deliveryRate = successCount / members.length;
    
    expect(deliveryRate).toBeGreaterThan(0.99);
  });
});
```

### Stream recovery testing

```typescript
describe('Stream recovery', () => {
  test('stream recovery after network interruption', async () => {
    const [sender, receiver] = await createClients(2);
    const conversation = await sender.conversations.newConversation(receiver.address);
    
    // Start stream
    const stream = receiver.conversations.stream();
    
    // Simulate network interruption
    await simulateNetworkInterruption(receiver, 5000);
    
    // Send message during interruption
    await conversation.send('Message during interruption');
    
    // Verify message received after recovery
    const recoveredMessage = await waitForStreamRecovery(stream, 'Message during interruption');
    expect(recoveredMessage).toBeDefined();
  });
});
```

## Stream monitoring

### Real-time metrics

```typescript
// Stream performance metrics collection
const streamMetrics = {
  delivery_rate: deliveredMessages / sentMessages,
  order_accuracy: correctlyOrderedMessages / totalMessages,
  response_time: streamDeliveryTime,
  recovery_time: networkRecoveryTime
};

// Submit to monitoring system
await submitStreamMetrics(streamMetrics, {
  group_size: groupSize,
  environment: 'production',
  test_type: 'reliability'
});
```

### Performance dashboards

**Stream delivery tracking**
- Real-time delivery rate visualization
- Order accuracy trending
- Response time percentiles
- Recovery time analysis

**Alert thresholds**
```yaml
stream_alerts:
  delivery_rate:
    warning: < 99%
    critical: < 98%
  
  order_accuracy:
    warning: < 99.5%
    critical: < 99%
  
  response_time:
    warning: > 1000ms
    critical: > 2000ms
```

## Stream optimization

### Performance tuning

**Connection pooling**
```typescript
// Optimize stream connections
const streamConfig = {
  maxConnections: 100,
  keepAlive: true,
  heartbeatInterval: 30000,
  reconnectBackoff: 'exponential'
};
```

**Message batching**
```typescript
// Batch messages for better throughput
const batchConfig = {
  maxBatchSize: 10,
  batchTimeout: 100, // ms
  prioritizeOrder: true
};
```

### Scaling considerations

**Large group optimization**
- Implement message routing optimization
- Use server-side filtering for relevance
- Optimize client-side stream processing
- Implement adaptive quality controls

**Network adaptation**
- Adjust stream quality based on connection
- Implement graceful degradation
- Use compression for large messages
- Optimize for mobile networks

## Troubleshooting streams

### Common stream issues

**Messages not delivered via stream**
```bash
# Check stream connection status
yarn test streams:connection-check --client=receiver

# Validate stream subscription
yarn test streams:subscription-check --group-id=group123
```

**Out-of-order message delivery**
```bash
# Test message ordering
yarn test streams:order-debug --concurrent-senders=3

# Check timestamp accuracy
yarn test streams:timestamp-validation
```

**High stream latency**
```bash
# Profile stream performance
yarn test streams:profile --group-size=100

# Check network conditions
yarn test streams:network-analysis
```

### Debug utilities

```bash
# Stream connection diagnostics
yarn test streams:diagnose --verbose

# Message flow tracing
yarn test streams:trace --message-id=msg123

# Performance profiling
yarn test streams:profile --duration=300s
```

## Stream reliability improvements

### Current optimizations

- Connection pooling for reduced overhead
- Heartbeat mechanisms for connection health
- Exponential backoff for reconnection
- Message deduplication for reliability

### Planned enhancements

- Adaptive streaming based on network conditions
- Intelligent message routing for large groups
- Enhanced recovery mechanisms
- Server-side stream optimization
