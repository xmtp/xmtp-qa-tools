# Agents QA

Quality assurance framework for XMTP agents, bots, and automated services deployed across the network.

## Agent monitoring overview

Continuous testing validates agent responsiveness, reliability, and functionality across multiple deployment environments.

## Monitored agents

### Production agents

| Agent | Address | Function | SLO target | Test frequency |
|-------|---------|----------|------------|----------------|
| hi.xmtp.eth | 0x937C0d4a6294cdfa575de17382c7076b579DC176 | Greeting bot | <2s response | Every 15 min |
| key-check.eth | 0x235017975ed5F55e23a71979697Cd67DcAE614Fa | Key validation | <5s response | Every 15 min |

### Test agents

| Agent | Environment | Purpose | Monitoring |
|-------|-------------|---------|------------|
| stress-test | dev/production | Load testing | Response time, uptime |
| echo-bot | dev | Message echo | Delivery rate, latency |
| debug-agent | dev | Protocol debugging | Error rates, logs |

## Agent test suite

### Response time testing

```bash
# Run agent response time tests
yarn test agents:response-time

# Test specific agent
yarn test agents:health-check --agent=hi.xmtp.eth
```

### Load testing

```bash
# Stress test with multiple concurrent requests
yarn test agents:stress --concurrency=50 --duration=300s
```

## Performance metrics

### Response time targets

| Agent type | P50 target | P95 target | P99 target |
|------------|------------|------------|------------|
| Simple bots | <1s | <2s | <5s |
| Complex agents | <2s | <5s | <10s |

### Availability targets

| Service level | Target | Measurement period |
|---------------|--------|--------------------|
| Agent uptime | 99.5% | 30 days |
| Response rate | 99% | 24 hours |
| Error rate | <1% | 24 hours |

## Troubleshooting

### Common issues

**Agent not responding**
```bash
# Check agent health endpoint
curl -f https://agent.railway.app/health

# Test agent manually
yarn test agents:manual --agent=hi.xmtp.eth
```
