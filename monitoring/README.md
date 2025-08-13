# Monitoring system

Monitoring that validates protocol functionality and alerts when things break.

## Automated workflows

| Test suite  | Status                                                                                                                                                                       | Resources                                                                                                                                                                         | Run frequency | Networks           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Performance | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/performance.test.ts) | Every 30 min  | `dev` `production` |
| Delivery    | [![Dev Delivery](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml)      | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/delivery.test.ts)       | Every 30 min  | `dev` `production` |
| Agents      | [![Agents](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)                | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents)                   | Every 5 min   | `dev` `production` |
| Browser     | [![Browser](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml)             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/browser/browser.test.ts) | Every 30 min  | `dev` `production` |

---

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
