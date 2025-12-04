# XMTP Load Test Framework

High-performance load testing framework for XMTP messaging system, capable of sending **5+ million messages per day**.

## 🚀 Features

- **Scalable Architecture**: Built on Artillery.io with worker pool management
- **Configurable Load Profiles**: Control identities, groups, members, concurrency, and duration
- **Pre-configured Setup**: Separate setup phase for identity and group creation
- **Distributed Load**: Messages spread evenly across multiple groups
- **Real-time Metrics**: Track message throughput, latency, and error rates
- **Two Testing Modes**: Full Artillery-based or simple TypeScript runner

## 📋 Prerequisites

- Node.js 18+ with `tsx` support
- XMTP SDK access
- Sufficient system resources (recommended: 4+ CPU cores, 8GB+ RAM for high throughput)

## 🛠️ Installation

```bash
cd load-test
npm install
```

Or if using yarn:

```bash
yarn install
```

## 📖 Quick Start

### 1. Setup Test Environment

Create test identities and groups before running the load test:

```bash
npm run setup -- \
  --identities 100 \
  --groups 10 \
  --members 20 \
  --env dev
```

**Parameters:**
- `--identities, -i`: Number of test identities to create (minimum 2)
- `--groups, -g`: Number of group chats to create (minimum 1)
- `--members, -m`: Number of members per group (minimum 2, max = identities)
- `--env, -e`: XMTP environment (`dev` or `production`, default: `dev`)
- `--output, -o`: Output directory for config files (default: `./data`)

**Example Output:**
```
🚀 XMTP Load Test Setup
============================================================
Identities: 100
Groups: 10
Members per group: 20
Environment: dev
Output: ./data
============================================================

📝 Step 1: Creating 100 identities...
✓ Created identity: 0xABCD... (inbox: 1234abcd...)
...
✅ Created 100 identities in 45.2s

🔗 Step 2: Creating 10 groups...
✓ Created group 1: a83166f3ab057f28... (20 members)
...
✅ Created 10 groups in 12.8s

💾 Step 3: Saving configuration...
✓ Saved configuration to: ./data/load-test-config.json
✓ Saved summary to: ./data/summary.json

============================================================
✅ Setup Complete!
============================================================
Total identities: 100
Total groups: 10
Avg members/group: 20.0
Setup time: 58.0s

🚀 Ready for load testing! Run: npm run test
============================================================
```

### 2. Run Load Test

#### Option A: Artillery (Full-featured)

Run the full Artillery-based load test with worker pools:

```bash
npm run test
```

For detailed reporting:

```bash
npm run test:debug
npm run report
```

#### Option B: Simple Runner (Debugging)

For quick tests or debugging:

```bash
npm run test:simple
```

## ⚙️ Configuration

### Artillery Configuration (`artillery-config.yml`)

Control the load profile by editing the phases:

```yaml
phases:
  # Warm-up phase
  - duration: 300        # 5 minutes
    arrivalRate: 10      # Start: 10 VU/s
    rampTo: 50           # Ramp to: 50 VU/s
    name: "Warm-up"
  
  # Sustained load phase
  - duration: 82800      # 23 hours
    arrivalRate: 60      # 60 messages/second
    name: "Sustained Load"
  
  # Cool-down phase
  - duration: 300        # 5 minutes
    arrivalRate: 60
    rampTo: 10
    name: "Cool-down"

# Worker pool size (tune based on CPU cores)
pool: 10
```

**Key Metrics:**
- `arrivalRate`: Virtual users (messages) per second
- `duration`: Phase duration in seconds
- `rampTo`: Target arrival rate (for gradual ramp-up/down)
- `pool`: Number of worker processes

**Example Load Calculations:**

| Rate (msg/s) | Duration | Total Messages | Messages/Day |
|--------------|----------|----------------|--------------|
| 60           | 24h      | 5,184,000      | 5.2M         |
| 100          | 24h      | 8,640,000      | 8.6M         |
| 50           | 12h      | 2,160,000      | 4.3M (×2)    |

### Simple Runner Configuration (`run-simple.ts`)

Edit the CONFIG object:

```typescript
const CONFIG = {
  configPath: "./data/load-test-config.json",
  targetRate: 60,              // messages per second
  duration: 60,                // seconds
  concurrency: cpus().length,  // parallel workers
};
```

## 📊 Monitoring & Metrics

### Artillery Metrics

Artillery provides comprehensive metrics:

- **Throughput**: Messages per second (actual vs target)
- **Latency**: p50, p95, p99 message send times
- **Errors**: Error rate and error types
- **System**: CPU and memory usage

View real-time output during the test:

```
Summary report @ 14:32:15(+0000)
  Scenarios launched:  3600
  Scenarios completed: 3595
  Requests completed:  3595
  Mean response/sec:   60.12
  Response time (msec):
    min: 45
    max: 1234
    median: 123
    p95: 456
    p99: 789
  Errors: 5
```

### Custom Metrics

The processor emits custom metrics:

```javascript
events.emit('counter', 'messages.sent', 1);
events.emit('histogram', 'message.send.duration', duration);
events.emit('counter', 'messages.failed', 1);
```

### Log Output

Worker logs show real-time progress:

```
[Worker 12345] Rate: 58.42 msg/s | Total: 3542 messages
[Worker 12346] Rate: 61.23 msg/s | Total: 3689 messages
```

## 🔧 Advanced Usage

### Custom Load Profiles

Create different load profiles for various test scenarios:

**Spike Test:**
```yaml
phases:
  - duration: 60
    arrivalRate: 10
  - duration: 120        # 2-minute spike
    arrivalRate: 200     # 200 msg/s spike
  - duration: 60
    arrivalRate: 10
```

**Ramp Test:**
```yaml
phases:
  - duration: 3600       # 1 hour ramp
    arrivalRate: 1
    rampTo: 100          # 1 → 100 msg/s
```

**Stress Test:**
```yaml
phases:
  - duration: 1800       # 30 minutes
    arrivalRate: 500     # Push to limits
```

### Environment Variables

Set environment variables for additional control:

```bash
# Use custom config path
export CONFIG_PATH=./custom-config.json

# XMTP environment
export XMTP_ENV=production

# Artillery workers
export ARTILLERY_WORKERS=20
```

### Running on EC2

For production load testing on EC2:

1. **Choose appropriate instance type:**
   - Recommended: `c5.2xlarge` (8 vCPUs, 16GB RAM)
   - For higher load: `c5.4xlarge` or `c5.9xlarge`

2. **Tune worker pool:**
   ```yaml
   pool: 16  # Match vCPU count
   ```

3. **Monitor system resources:**
   ```bash
   htop  # CPU and memory
   iotop # Disk I/O
   ```

4. **Use screen/tmux for long tests:**
   ```bash
   screen -S loadtest
   npm run test
   # Ctrl+A, D to detach
   ```

### Running Multiple Tests

To run multiple concurrent tests with different configs:

```bash
# Terminal 1: Groups 1-5
CONFIG_PATH=./data/config-1.json npm run test

# Terminal 2: Groups 6-10
CONFIG_PATH=./data/config-2.json npm run test
```

## 🐛 Troubleshooting

### Issue: "Config not found"

**Solution:** Run setup first:
```bash
npm run setup -- -i 50 -g 5 -m 10 -e dev
```

### Issue: High error rate

**Possible causes:**
- Network connectivity issues
- XMTP node overload
- Insufficient system resources
- Database locking issues

**Solutions:**
- Reduce `arrivalRate` in config
- Reduce `pool` size
- Check system resources (`htop`, `free -h`)
- Ensure DB directory is writable

### Issue: Low throughput

**Solutions:**
- Increase `pool` size in `artillery-config.yml`
- Use more powerful EC2 instance
- Reduce number of groups (less contention)
- Check network latency to XMTP nodes

### Issue: Memory leak

**Solutions:**
- Reduce number of concurrent clients
- Periodically restart workers (use shorter test durations)
- Monitor with `node --max-old-space-size=4096`

## 📁 File Structure

```
load-test/
├── package.json              # Dependencies and scripts
├── README.md                 # This file
├── setup.ts                  # Setup script (creates identities/groups)
├── artillery-config.yml      # Artillery configuration
├── artillery-processor.ts    # Message sending logic
├── run-simple.ts            # Simple TypeScript runner
├── build.sh                 # Build processor for Artillery
├── .gitignore               # Git ignore rules
└── data/                    # Generated data (gitignored)
    ├── load-test-config.json  # Test configuration
    ├── summary.json           # Setup summary
    └── dbs/                   # Client databases
        ├── 1234abcd.db3
        └── ...
```

## 🎯 Performance Targets

Based on configuration:

| Setup | Groups | Identities | Rate | Expected Daily Volume |
|-------|--------|------------|------|-----------------------|
| Small | 5      | 25         | 30   | 2.6M messages         |
| Medium| 10     | 100        | 60   | 5.2M messages         |
| Large | 20     | 200        | 100  | 8.6M messages         |
| XLarge| 50     | 500        | 150  | 13M messages          |

## 🧹 Cleanup

Remove all test data and artifacts:

```bash
npm run clean
```

Or manually:

```bash
rm -rf data/ *.db3 report.json artillery-processor.js
```

## 📚 Additional Resources

- [Artillery Documentation](https://www.artillery.io/docs)
- [XMTP Agent SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk)
- [XMTP Documentation](https://docs.xmtp.org)

## 🤝 Contributing

To add new features or improve the load test:

1. Test your changes with the simple runner first
2. Ensure Artillery processor is properly typed
3. Update this README with new configuration options
4. Test at multiple scales (small → medium → large)

## 📝 License

Same as parent repository.


