# Monitoring system

Monitoring that validates protocol functionality and alerts when things break.

## Automated workflows

| Test suite  | Status                                                                                                                                                                       | Resources                                                                                                                                                                         | Run frequency | Networks           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Performance | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/performance.test.ts) | Every 30 min  | `dev` `production` |
| Delivery    | [![Dev Delivery](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml)      | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/delivery.test.ts)       | Every 30 min  | `dev` `production` |
| Regression  | [![Regression](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml)    | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/functional)           | Every 2 hours | `dev` `production` |
| Agents      | [![Agents](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)                | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/agents)                   | Every 5 min   | `dev` `production` |
| Browser     | [![Browser](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml)             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/browser/browser.test.ts) | Every 30 min  | `dev` `production` |

---

## 1) Performance

Location: [`monitoring/performance.test.ts`](../monitoring/performance.test.ts)

- Timing/throughput for core ops (create, canMessage, inboxState, DM send/stream)
- Scaled group ops per size (create, sync, add/remove members, metadata updates)

## 2) Delivery

Location: [`monitoring/delivery.test.ts`](../monitoring/delivery.test.ts)

- Message delivery and order via streams and polling
- Recovery after stream interruptions

## 3) Regression (functional tests)

Location: [`monitoring/functional`](../monitoring/functional)

- Clients
  - Stream restart validation (prev 4.0.2 bug)
  - Downgrade and upgrade across last 3 SDK versions (DM delivery check)
- Streams
  - New conversation stream, member additions
  - DM consent and group consent changes
  - DM delivery, group delivery, metadata updates
  - Add member to existing group
  - Codec error handling for unsupported content types
- Conversations
  - New DM by inbox ID and by Ethereum address
  - Send + streamMessage for DMs
  - Per-size groups: create, sync, update name
- Other
  - Group stream/sync flow
  - Track epoch changes during group operations
  - Stitching across fresh clients

## 4) Browser

Location: [`monitoring/browser/browser.test.ts`](../monitoring/browser/browser.test.ts)

- Core conversation + message streaming flows in browser SDK (Playwright)

## 5) Large groups

- Scalability checks across 50–250 members (create, sync, stream, metadata)

## 6) Network chaos

Location: [`monitoring/networkchaos`](../monitoring/networkchaos)

- Resilience under partitions/delays/failures on a local 4-node cluster
- Includes smoke tests, DM duplicate prevention, group reconciliation, client partition, key rotation
