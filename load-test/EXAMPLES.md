# XMTP Load Test Examples

This document provides example configurations and scenarios for different load testing needs.

## Example 1: Small Development Test

**Goal:** Quick validation of messaging functionality  
**Scale:** 2.6M messages/day

```bash
# Setup
npm run setup -- -i 25 -g 5 -m 10 -e dev

# Configure artillery-config.yml
phases:
  - duration: 300
    arrivalRate: 10
    rampTo: 30
  - duration: 82800
    arrivalRate: 30
  - duration: 300
    arrivalRate: 30
    rampTo: 10

pool: 4
```

**Expected Results:**
- ~2.6M messages per day
- Low resource usage
- Good for development/staging

## Example 2: Medium Production Test

**Goal:** Realistic production load  
**Scale:** 5.2M messages/day

```bash
# Setup
npm run setup -- -i 100 -g 10 -m 20 -e production

# Configure artillery-config.yml
phases:
  - duration: 300
    arrivalRate: 10
    rampTo: 60
  - duration: 82800
    arrivalRate: 60
  - duration: 300
    arrivalRate: 60
    rampTo: 10

pool: 10
```

**Expected Results:**
- ~5.2M messages per day
- Moderate resource usage (4 CPU cores, 8GB RAM)
- Production-ready testing

**EC2 Instance:** `c5.2xlarge`

## Example 3: Large Scale Test

**Goal:** High-volume production simulation  
**Scale:** 8.6M messages/day

```bash
# Setup
npm run setup -- -i 200 -g 20 -m 30 -e production

# Configure artillery-config.yml
phases:
  - duration: 600
    arrivalRate: 20
    rampTo: 100
  - duration: 82800
    arrivalRate: 100
  - duration: 600
    arrivalRate: 100
    rampTo: 20

pool: 16
```

**Expected Results:**
- ~8.6M messages per day
- High resource usage (8+ CPU cores, 16GB RAM)
- Stress testing

**EC2 Instance:** `c5.4xlarge` or `c5.9xlarge`

## Example 4: Spike Test

**Goal:** Test system behavior under sudden load spikes  
**Duration:** 15 minutes

```bash
# Setup (can reuse existing)
npm run setup -- -i 100 -g 10 -m 20 -e dev

# Configure artillery-config.yml
phases:
  - duration: 60
    arrivalRate: 10
  - duration: 300      # 5-minute spike
    arrivalRate: 200
  - duration: 60
    arrivalRate: 10

pool: 20
```

**Use Case:** Testing system resilience, auto-scaling, rate limiting

## Example 5: Ramp Test

**Goal:** Find the maximum sustainable throughput  
**Duration:** 1 hour

```bash
# Setup
npm run setup -- -i 150 -g 15 -m 25 -e production

# Configure artillery-config.yml
phases:
  - duration: 3600     # Gradual ramp over 1 hour
    arrivalRate: 1
    rampTo: 150

pool: 16
```

**Use Case:** Capacity planning, finding bottlenecks

## Example 6: Sustained Stress Test

**Goal:** Test system stability under maximum load  
**Duration:** 6 hours

```bash
# Setup
npm run setup -- -i 300 -g 30 -m 40 -e production

# Configure artillery-config.yml
phases:
  - duration: 600      # 10-minute ramp-up
    arrivalRate: 50
    rampTo: 200
  - duration: 21000    # 5 hours 50 minutes sustained
    arrivalRate: 200
  - duration: 600      # 10-minute ramp-down
    arrivalRate: 200
    rampTo: 50

pool: 32
```

**Use Case:** Endurance testing, memory leak detection

**EC2 Instance:** `c5.9xlarge` (36 vCPUs, 72GB RAM)

## Example 7: Multi-Environment Test

**Goal:** Test multiple environments simultaneously  
**Setup:** Run parallel tests

```bash
# Terminal 1: Dev environment
CONFIG_PATH=./data/dev-config.json npm run setup -- -i 50 -g 5 -m 15 -e dev -o ./data-dev
CONFIG_PATH=./data-dev/load-test-config.json npm run test

# Terminal 2: Staging environment
CONFIG_PATH=./data/staging-config.json npm run setup -- -i 75 -g 8 -m 20 -e staging -o ./data-staging
CONFIG_PATH=./data-staging/load-test-config.json npm run test

# Terminal 3: Production environment
CONFIG_PATH=./data/prod-config.json npm run setup -- -i 100 -g 10 -m 25 -e production -o ./data-prod
CONFIG_PATH=./data-prod/load-test-config.json npm run test
```

## Example 8: Quick Smoke Test

**Goal:** Fast validation (5 minutes)  
**Use:** CI/CD pipelines

```bash
# Setup (minimal)
npm run setup -- -i 10 -g 2 -m 5 -e dev

# Run simple test runner
npm run test:simple
```

Edit `run-simple.ts`:
```typescript
const CONFIG = {
  targetRate: 10,
  duration: 300,  // 5 minutes
  concurrency: 2,
};
```

## Example 9: Gradual Daily Load

**Goal:** Simulate realistic daily usage patterns  
**Duration:** 24 hours

```bash
# Setup
npm run setup -- -i 150 -g 15 -m 25 -e production

# Configure artillery-config.yml
phases:
  # Night (low activity) - 6 hours
  - duration: 21600
    arrivalRate: 10
  
  # Morning ramp-up - 2 hours
  - duration: 7200
    arrivalRate: 10
    rampTo: 80
  
  # Peak hours - 8 hours
  - duration: 28800
    arrivalRate: 80
  
  # Evening ramp-down - 2 hours
  - duration: 7200
    arrivalRate: 80
    rampTo: 20
  
  # Night (low activity) - 6 hours
  - duration: 21600
    arrivalRate: 20

pool: 12
```

**Use Case:** Realistic production simulation

## Example 10: Geographic Distribution

**Goal:** Test from multiple regions  
**Setup:** Deploy to multiple EC2 regions

```bash
# US East
# EC2 us-east-1
npm run setup -- -i 100 -g 10 -m 20 -e production -o ./data-us-east
CONFIG_PATH=./data-us-east/load-test-config.json npm run test

# Europe
# EC2 eu-west-1
npm run setup -- -i 80 -g 8 -m 20 -e production -o ./data-eu
CONFIG_PATH=./data-eu/load-test-config.json npm run test

# Asia
# EC2 ap-southeast-1
npm run setup -- -i 60 -g 6 -m 20 -e production -o ./data-asia
CONFIG_PATH=./data-asia/load-test-config.json npm run test
```

**Use Case:** Testing geographic performance, CDN effectiveness

## Interpreting Results

### Success Rate

```
✅ > 99%   - Excellent, system is stable
⚠️  95-99% - Good, minor issues
❌ < 95%   - Poor, investigate errors
```

### Latency (p95)

```
✅ < 200ms  - Excellent performance
⚠️  200-500ms - Acceptable
❌ > 500ms  - Poor, optimization needed
```

### Throughput

Compare actual rate vs target rate:

```
✅ > 95% of target - Good
⚠️  85-95% of target - Investigate bottlenecks
❌ < 85% of target - System overloaded
```

## Troubleshooting Common Scenarios

### Scenario: Error Rate Increases Over Time

**Symptoms:** Tests start well but errors accumulate  
**Likely Causes:**
- Memory leaks
- Database locking
- Connection pool exhaustion

**Solutions:**
- Reduce test duration
- Add cleanup between phases
- Monitor memory usage

### Scenario: Low Throughput Despite Available Resources

**Symptoms:** CPU/RAM underutilized, low message rate  
**Likely Causes:**
- Too few workers
- Network bottleneck
- Rate limiting

**Solutions:**
- Increase `pool` size
- Check network latency
- Verify XMTP node capacity

### Scenario: High Latency Spikes

**Symptoms:** p99 >> p95, occasional very slow messages  
**Likely Causes:**
- Garbage collection
- Database I/O
- Network issues

**Solutions:**
- Tune Node.js garbage collection
- Use faster storage (SSD)
- Reduce concurrency

## Best Practices

1. **Start Small:** Always begin with a small test to validate setup
2. **Ramp Gradually:** Don't jump to max load immediately
3. **Monitor Continuously:** Watch system metrics during tests
4. **Document Results:** Save reports and configs for comparison
5. **Test Incrementally:** Increase load in steps to find limits
6. **Cleanup Between Tests:** Clear databases and restart services
7. **Use Production-Like Data:** Test with realistic message sizes
8. **Test Failure Scenarios:** Simulate network issues, node failures
9. **Automate Analysis:** Use `npm run analyze` for consistent reporting
10. **Version Control Configs:** Track changes to test configurations


