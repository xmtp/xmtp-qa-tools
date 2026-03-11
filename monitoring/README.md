# Monitoring system

Monitoring that validates protocol functionality and alerts when things break.

## Automated workflows

| Test suite  | Status                                                                                                                                                                       | Resources                                                                                                                                                                         | Run frequency | Networks           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Performance | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/performance.test.ts) | Every 30 min  | `dev` `production` |
| Delivery    | [![Dev Delivery](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml)      | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/delivery.test.ts)       | Every 30 min  | `dev` `production` |
| Browser     | [![Browser](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml)             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/browser/browser.test.ts) | Every 30 min  | `dev` `production` |

## 1) Performance

Location: [`monitoring/performance.test.ts`](../monitoring/performance.test.ts)

- Timing/throughput for core ops (create, canMessage, inboxState, DM send/stream)
- Scaled group ops per size (create, sync, add/remove members, metadata updates)
- Scalability checks across 50–250 members (create, sync, stream, metadata)

## 2) Delivery

Location: [`monitoring/delivery.test.ts`](../monitoring/delivery.test.ts)

- Message delivery and order via streams and polling
- Recovery after stream interruptions
- Tests with regressions from the last 3 versions

## 3) Other

Location: [`monitoring/browser/browser.test.ts`](../monitoring/browser/browser.test.ts)

- Core conversation + message streaming flows in browser SDK (Playwright)

## 6) Network chaos

Location: [`monitoring/networkchaos`](../monitoring/networkchaos)

- Resilience under partitions/delays/failures on a local 4-node cluster
- Includes smoke tests, DM duplicate prevention, group reconciliation, client partition, key rotation

## Estimated daily write operations

- **Performance Tests**: 1,440 writes/day (group creates, sends, updates, adds/removes across sizes)
- **Delivery Tests**: 7,224 writes/day (group creates + 150 sends per run across 3 tests)
- **Agents-DMs Tests**: 5,400 writes/day (DM creates + sends with retries per agent)
- **Total Daily Writes**: ~14,064

---

## Protocol Performance Metrics (group-stats)

Location: [`monitoring/group-stats.test.ts`](../monitoring/group-stats.test.ts)  
Workflow: [`ProtocolPerformanceStats.yml`](../.github/workflows/ProtocolPerformanceStats.yml)

These tests emit the protocol performance metric family (`metric_family:group_stats_v1`) and are designed for cross-repo parity checks.

### Local prerequisites

- Set `DATADOG_API_KEY` only if you want to send data to Datadog.
- For testnet environments, set gateway host env vars:
  - `XMTP_GATEWAY_HOST_TESTNET_STAGING`
  - `XMTP_GATEWAY_HOST_TESTNET_DEV`
- If these are not set, runtime falls back to `XMTP_GATEWAY_HOST`.

### Run protocol metrics locally

Run the full group-stats matrix locally and write metrics to a local NDJSON sink:

```bash
yarn test group-stats --env testnet-staging --size 10-50 --attempts 15 --max-retry 1 --no-fail --log Warn --file --local-metrics --local-metrics-file logs/protocol-performance.ndjson
```

Run the same suite against `testnet-dev`:

```bash
yarn test group-stats --env testnet-dev --size 10-50 --attempts 15 --max-retry 1 --no-fail --log Warn --file --local-metrics --local-metrics-file logs/protocol-performance.ndjson
```

Run against regular `dev`:

```bash
yarn test group-stats --env dev --size 10-50 --attempts 15 --max-retry 1 --no-fail --log Warn --file --local-metrics --local-metrics-file logs/protocol-performance.ndjson
```

### Enable logs locally

Recommended log levels (least to most verbose):

- `error`
- `warn`
- `info`
- `debug`
- `trace` (highest volume; use only when needed)

Use flags instead of setting env vars manually:

- `--log <level>` controls XMTP SDK / node-bindings logging (`LOGGING_LEVEL`)
- `--winston <level>` controls JS logger verbosity (`LOG_LEVEL`)

Save verbose logs to file while running group-stats:

```bash
yarn test group-stats --env dev --size 10-50 --attempts 1 --max-retry 1 --no-fail --no-datadog --log debug --winston debug --file --local-metrics --local-metrics-file logs/protocol-performance.ndjson
```

Show logs directly in terminal (do not pass `--file`):

```bash
yarn test group-stats --env dev --size 10-50 --attempts 1 --max-retry 1 --no-fail --no-datadog --log debug --winston debug
```

View the latest saved group-stats log:

```bash
ls -lt logs/raw-group-stats-*.log | head -n 1
```

### Clear local stats before a fresh run

Clear both raw logs and local metrics sink data:

```bash
rm -rf logs
mkdir -p logs
unset LOCAL_METRICS_APPEND
```

If you also want a full worker/data reset:

```bash
yarn clean
mkdir -p logs
```

### Run one specific test in one specific environment

Example: run only `addMember-10` in `testnet-dev` and keep metrics local:

```bash
yarn test group-stats --env testnet-dev --size 10 --attempts 1 --max-retry 1 --no-fail --no-datadog --file --log Warn --local-metrics --local-metrics-file logs/addmember-testnet-dev-10.ndjson -t addMember-10
```

Example: same test in `testnet-staging`:

```bash
yarn test group-stats --env testnet-staging --size 10 --attempts 1 --max-retry 1 --no-fail --no-datadog --file --log Warn --local-metrics --local-metrics-file logs/addmember-testnet-staging-10.ndjson -t addMember-10
```

### View local summaries

Default comparison summary:

```bash
yarn metrics:summary --file logs/protocol-performance.ndjson
```

Status view (current package default compares `testnet-staging` vs `testnet-dev`):

```bash
yarn metrics:status --file logs/protocol-performance.ndjson
```

### Compare environments from local sink

For local comparison, both environments must be present in the same NDJSON file (or in a merged file).

Example flow using one file:

```bash
# Start clean
rm -f logs/protocol-performance.ndjson

# Run left env (creates file)
yarn test group-stats --env testnet-staging --size 10-50 --attempts 5 --max-retry 1 --no-fail --no-datadog --local-metrics --local-metrics-file logs/protocol-performance.ndjson

# Run right env (append to same file)
LOCAL_METRICS_APPEND=true yarn test group-stats --env testnet-dev --size 10-50 --attempts 5 --max-retry 1 --no-fail --no-datadog --local-metrics --local-metrics-file logs/protocol-performance.ndjson

# Compare
yarn metrics:status --file logs/protocol-performance.ndjson --env testnet-staging,testnet-dev --compare-left testnet-staging --compare-right testnet-dev
```

Compare `testnet-staging` vs `testnet-dev`:

```bash
yarn metrics:status --file logs/protocol-performance.ndjson --env testnet-staging,testnet-dev --compare-left testnet-staging --compare-right testnet-dev
```

Compare `testnet-staging` vs regular `dev`:

```bash
yarn metrics:status --file logs/protocol-performance.ndjson --env testnet-staging,dev --compare-left testnet-staging --compare-right dev
```
