# Workflows

This is how we automate all our testing and make sure nothing breaks without us knowing about it immediately. We've got GitHub Actions running pretty much constantly, testing everything from basic functionality to large-scale performance under different conditions.

## Core test workflows

### 1. Functional test workflow

**File**: `.github/workflows/Functional.yml`
**What it does**: Makes sure the basic XMTP protocol stuff actually works (see [functional test suite](../test-suites.md#1-functional-test-suite))

```yaml
name: Functional
on:
  schedule:
    - cron: "0 */3 * * *" # Every 3 hours

jobs:
  functional-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        env: [dev, production]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "yarn"
      - run: yarn install --frozen-lockfile
      - run: yarn test functional
        env:
          XMTP_ENV: ${{ matrix.env }}
```

See [Test suites](./test-suites.md) for details.

### 2. Performance test workflow

**File**: `.github/workflows/Performance.yml`
**Purpose**: Benchmarks SDK operations and measures latency (see [performance test suite](../test-suites.md#2-performance-test-suite))

```yaml
name: Performance
on:
  schedule:
    - cron: "*/30 * * * *" # Every 30 minutes

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: yarn install --frozen-lockfile
      - run: yarn test performance
        env:
          XMTP_ENV: production
```

### 3. Delivery test workflow

**File**: `.github/workflows/Delivery.yml`
**Purpose**: Validates message delivery reliability across environments (see [delivery test suite](../test-suites.md#3-delivery-test-suite))

```yaml
name: Delivery
on:
  schedule:
    - cron: "*/30 * * * *" # Every 30 minutes

jobs:
  delivery-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        source-env: [dev, production]
        target-env: [dev, production]
    steps:
      - name: Cross-environment delivery test
        run: yarn test delivery:cross-env
        env:
          SOURCE_ENV: ${{ matrix.source-env }}
          TARGET_ENV: ${{ matrix.target-env }}
```

### 4. Large groups test workflow

**File**: `.github/workflows/Large.yml`
**Purpose**: Tests group functionality at scale (up to 400 members) (see [groups test suite](../test-suites.md#4-groups-large-scale-test-suite))

```yaml
name: Large Groups
on:
  schedule:
    - cron: "0 */2 * * *" # Every 2 hours

jobs:
  large-group-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 180 # 3 hour timeout for large groups

    strategy:
      matrix:
        group-size: [50, 100, 200, 400]
        env: [dev, production]

    steps:
      - name: Run large group test
        run: yarn test metrics/large
        env:
          GROUP_SIZE: ${{ matrix.group-size }}
          XMTP_ENV: ${{ matrix.env }}
          TEST_TIMEOUT: 7200000 # 2 hour timeout
```

### 5. Agents test workflow

**File**: `.github/workflows/Agents.yml`
**Purpose**: Monitors deployed bot and agent health (see [agents test suite](../test-suites.md#5-agents-test-suite))

```yaml
name: Agents
on:
  schedule:
    - cron: "*/15 * * * *" # Every 15 minutes

jobs:
  agent-health-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent:
          - name: "hi.xmtp.eth"
            address: "0x937C0d4a6294cdfa575de17382c7076b579DC176"
            expected-response: "hi"
          - name: "key-check.eth"
            address: "0x235017975ed5F55e23a71979697Cd67DcAE614Fa"
            expected-response: "Key package status"

    steps:
      - name: Test agent responsiveness
        run: yarn test agents:health-check
        env:
          AGENT_NAME: ${{ matrix.agent.name }}
          AGENT_ADDRESS: ${{ matrix.agent.address }}
          EXPECTED_RESPONSE: ${{ matrix.agent.expected-response }}
```

### 6. Browser test workflow

**File**: `.github/workflows/Browser.yml`
**Purpose**: Validates XMTP functionality in browser environments using Playwright (see [browser test suite](../test-suites.md#6-browser-test-suite))

```yaml
name: Browser
on:
  schedule:
    - cron: "*/30 * * * *" # Every 30 minutes

jobs:
  browser-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: yarn install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install

      - name: Run browser tests
        run: yarn test browser
        env:
          XMTP_ENV: production

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Deployment workflows

- Deploy.yml: Handles Railway deployments on version bumps.
- Bot deployment: Configured via railway.toml.

## Validation workflows

- Code quality: Lint, type check, unit tests on PR/push.
- Package compatibility: Tests across OS and Node versions.

## Specialized workflows

See [Test suites](./test-suites.md) for network chaos and agent validation.

## Monitoring and alerting

### Workflow health monitoring

**Datadog Integration**:

```typescript
// Automatic workflow metrics submission
const workflowMetrics = {
  "github.workflow.execution_time": executionTime,
  "github.workflow.success_rate": successRate,
  "github.workflow.failure_count": failureCount,
};

await submitMetrics(workflowMetrics, {
  workflow_name: "functional",
  environment: "production",
  branch: "main",
});
```

### Failure alerting

**Slack Integration**:

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    channel: "#xmtp-qa-alerts"
    text: |
      🚨 Workflow Failed: ${{ github.workflow }}
      Branch: ${{ github.ref }}
      Commit: ${{ github.sha }}
      Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Success rate tracking

**SLO Monitoring**:

- **Functional Tests**: 98% success rate over 24 hours
- **Performance Tests**: 95% success rate over 24 hours
- **Delivery Tests**: 99% success rate over 24 hours
- **Agent Health**: 99% success rate over 24 hours

## Best practices

- Idempotent operations
- Fast feedback
- Resource efficiency
- Comprehensive coverage
