# Agents QA

We run a bunch of bots and automated agents on the XMTP network, and we need to make sure they're actually working and responding to users properly. This is how we keep track of them and test that they're doing their job.

### Agents response times widget

Bot response time monitoring:

```bash
Query: avg:xmtp.sdk.response{$env,$region, test:agents-dms, $sdk} by {agent}
```

### Agent monitoring

- **Agent timeout [production]**: Alerts when agents stop responding
- **Agent answering without mention in groups**: Monitors bot behavior in group conversations
- **Agent timeout**: General agent responsiveness monitoring

## Monitored agents

### Production agents

| Agent         | Address                                    | Function       | SLO target   | Test frequency |
| ------------- | ------------------------------------------ | -------------- | ------------ | -------------- |
| hi.xmtp.eth   | 0x937C0d4a6294cdfa575de17382c7076b579DC176 | Greeting bot   | <2s response | Every 15 min   |
| key-check.eth | 0x235017975ed5F55e23a71979697Cd67DcAE614Fa | Key validation | <5s response | Every 15 min   |

### Test agents

| Agent       | Environment    | Purpose            | Monitoring             |
| ----------- | -------------- | ------------------ | ---------------------- |
| stress-test | dev/production | Load testing       | Response time, uptime  |
| echo-bot    | dev            | Message echo       | Delivery rate, latency |
| debug-agent | dev            | Protocol debugging | Error rates, logs      |

## Agent test suite

### Response time testing

```bash
yarn test agents:response-time

# Test specific agent
yarn test agents:health-check --agent=hi.xmtp.eth
```

### Load testing

```bash
yarn test agents:stress --concurrency=50 --duration=300s
```

See [SLOs and SLIs](./slos-slis.md) for metrics.
