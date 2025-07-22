# Forks

We need to make sure XMTP works properly when there are different versions of the protocol running at the same time, or when clients are using different SDK versions. This is how we test compatibility and make sure users don't get left behind when we ship updates.

## How we test protocol forks

We validate that everything still works during version transitions, network splits, and when clients are running different versions.

## Test categories

### Version compatibility testing

```bash
# Test cross-version messaging
yarn test forks:compatibility --from-version=2.0.0 --to-version=2.2.0

# Backward compatibility validation
yarn test forks:backward --versions=2.0.0,2.1.0,2.2.0
```

### Network fork scenarios

```bash
# Simulate network partition
yarn test forks:partition --duration=300s

# Test client behavior during splits
yarn test forks:split-brain
```

## Compatibility matrix

### SDK version compatibility

Here's what works with what (Full = everything works, Limited = basic features, None = don't even try):

| Client version | 2.0.x | 2.1.x | 2.2.x | 3.0.x |
|----------------|-------|-------|-------|-------|
| 2.0.x | Full | Limited | Limited | None |
| 2.1.x | Limited | Full | Full | Limited |
| 2.2.x | Limited | Full | Full | Full |
| 3.0.x | None | Limited | Full | Full |

### Protocol compatibility

| Feature | 2.0.x | 2.1.x | 2.2.x | Status |
|---------|-------|-------|-------|--------|
| Direct Messages | Yes | Yes | Yes | Stable |
| Group Messages | No | Yes | Yes | Added in 2.1 |
| Consent Framework | No | Limited | Yes | Enhanced in 2.2 |
| Large Groups | No | No | Yes | Added in 2.2 |

## Fork scenarios

### Protocol upgrade testing

```typescript
describe('Protocol upgrade scenarios', () => {
  test('client upgrade maintains conversation history', async () => {
    // Create conversation with old client
    const oldClient = await createClientWithVersion('2.1.0');
    const conversation = await oldClient.conversations.newConversation(peerAddress);
    await conversation.send('Message from old client');
    
    // Upgrade client
    const newClient = await upgradeClient(oldClient, '2.2.0');
    
    // Verify message history preserved
    const messages = await newClient.conversations
      .getConversation(peerAddress)
      .messages();
    expect(messages).toContainMessage('Message from old client');
  });
});
```

### Network split testing

```typescript
describe('Network partition scenarios', () => {
  test('message delivery after network reunion', async () => {
    const [client1, client2] = await createClients(2);
    
    // Simulate network partition
    await networkPartition.isolate(client1);
    
    // Send message during partition
    const conversation = await client2.conversations.newConversation(client1.address);
    await conversation.send('Message during partition');
    
    // Restore network
    await networkPartition.restore();
    
    // Verify message delivery after restoration
    await waitForMessage(client1, 'Message during partition');
  });
});
```

## Version migration testing

### Database migration validation

```bash
# Test database schema migration
yarn test forks:migrate --from=2.1.0 --to=2.2.0

# Validate data integrity after migration
yarn test forks:integrity-check
```

### Client state preservation

```typescript
// Test client state preservation during upgrades
const statePreservationTest = {
  conversations: await client.conversations.list(),
  messages: await getAllMessages(client),
  contacts: await client.contacts.list(),
  
  // Upgrade client
  upgradedClient: await upgradeClient(client, newVersion),
  
  // Validate state preserved
  validateConversations: () => {
    const newConversations = await upgradedClient.conversations.list();
    expect(newConversations.length).toBe(conversations.length);
  }
};
```

## Performance impact analysis

### Upgrade performance metrics

| Operation | Pre-upgrade | Post-upgrade | Impact |
|-----------|-------------|--------------|--------|
| Client creation | 588ms | 612ms | +4% |
| Message send | 126ms | 134ms | +6% |
| Group sync | 76ms | 82ms | +8% |
| Conversation list | 41ms | 43ms | +5% |

### Migration benchmarks

| Migration path | Duration | Data loss | Success rate |
|----------------|----------|-----------|--------------|
| 2.0.x → 2.1.x | 1.2s | 0% | 100% |
| 2.1.x → 2.2.x | 2.1s | 0% | 100% |
| 2.0.x → 2.2.x | 3.8s | 0% | 98% |

## Testing environments

### Fork test environments

```yaml
# Test environment configuration
environments:
  fork_testing:
    networks:
      - version: "2.1.0"
        endpoint: "https://grpc.v2-1.dev.xmtp.network"
      - version: "2.2.0" 
        endpoint: "https://grpc.v2-2.dev.xmtp.network"
    
    clients:
      - version: "2.1.0"
        count: 10
      - version: "2.2.0"
        count: 10
```

### Cross-version test matrix

```bash
# Run full compatibility matrix
yarn test forks:matrix

# Test specific version pair
yarn test forks:pair --v1=2.1.0 --v2=2.2.0

# Test with specific client counts
yarn test forks:load --old-clients=20 --new-clients=20
```

## Monitoring fork tests

### Compatibility metrics

```typescript
// Submit fork test metrics
await submitMetric('xmtp.fork.compatibility_rate', successRate, {
  from_version: '2.1.0',
  to_version: '2.2.0',
  test_type: 'message_delivery'
});

await submitMetric('xmtp.fork.migration_time', migrationDuration, {
  migration_path: '2.1.0_to_2.2.0',
  data_size: 'large'
});
```

### Alert thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Compatibility rate | <98% | <95% |
| Migration time | >5s | >10s |
| Data loss | >0% | >1% |
| Upgrade failure rate | >5% | >10% |

## Future fork planning

### Upcoming protocol changes

- Enhanced group permissions in v2.3
- Improved message encryption in v2.4
- Performance optimizations in v2.5

### Deprecation timeline

| Version | Deprecation date | End of life | Migration required |
|---------|-----------------|-------------|-------------------|
| 2.0.x | Q2 2024 | Q4 2024 | Yes |
| 2.1.x | Q4 2024 | Q2 2025 | Yes |
| 2.2.x | Q2 2025 | Q4 2025 | No |
