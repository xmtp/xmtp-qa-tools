# ✅ XMTP QA Testing Suite

This monorepo contains a comprehensive collection of tools for testing and monitoring the XMTP protocol and its implementations.

| Test Suite     | Dev Network Status                                                                                                                                                                                    | Production Network Status                                                                                                                                                                                                  | Run frequency |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 🚀 Performance | [![TS_Performance_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml) | [![TS_Performance_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml) | Every 30 min  |
| 📬 Delivery    | [![TS_Delivery_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml)          | [![TS_Delivery_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml)          | Every 30 min  |
| 👋 Gm          | [![TS_Gm_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml)                            | [![TS_Gm_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml)                            | Every 30 min  |
| 🌎 Geolocation | [![TS_Geolocation_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml) | [![TS_Geolocation_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml) | Every 30 min  |

## Overview

This assessment outlines how XMTP ensures messaging protocol reliability and performance, with focus on Messaging and Agents built using our Node SDK and React Native SDKs.

## 1. Operations performance

![](/media/performance.png)

### Core SDK Operations Performance

| Operation           | Description                            | Avg     | Target | Status       |
| ------------------- | -------------------------------------- | ------- | ------ | ------------ |
| createDM            | Creating a direct message conversation | 254-306 | <500ms | ✅ On Target |
| sendGM              | Sending a group message                | 123-132 | <200ms | ✅ On Target |
| receiveGM           | Receiving a group message              | 90-94   | <200ms | ✅ On Target |
| receiveGroupMessage | Processing group message streams       | 119-127 | <200ms | ✅ On Target |
| updateGroupName     | Updating group metadata                | 105-108 | <200ms | ✅ On Target |
| syncGroup           | Syncing group state                    | 78-89   | <200ms | ✅ On Target |
| addMembers          | Adding participants to a group         | 238-280 | <500ms | ✅ On Target |
| removeMembers       | Removing participants from a group     | 147-168 | <300ms | ✅ On Target |
| inboxState          | Checking inbox state                   | 36      | <100ms | ✅ On Target |

_Note: Based on data from 79 measured operations in the US testing environment._

### Group Operations Performance by Size

| Size | Create | Send | Sync | Update | Remove | (Create)  | Status                 |
| ---- | ------ | ---- | ---- | ------ | ------ | --------- | ---------------------- |
| 50   | 990    | 71   | 61   | 81     | 140    | <2,000ms  | ✅ On Target           |
| 100  | 1,599  | 67   | 66   | 91     | 182    | <2,000ms  | ✅ On Target           |
| 150  | 2,956  | 72   | 85   | 104    | 183    | <4,000ms  | ✅ On Target           |
| 200  | 4,598  | 73   | 103  | 139    | 211    | <5,000ms  | ✅ On Target           |
| 250  | 5,983  | 76   | 120  | 164    | 234    | <7,000ms  | ✅ On Target           |
| 300  | 8,707  | 81   | 321  | 255    | 309    | <9,000ms  | ✅ On Target           |
| 350  | 9,826  | 79   | 132  | 228    | 368    | <11,000ms | ⚠️ Performance Concern |
| 400  | 11,451 | 84   | 170  | 427    | 501    | <15,000ms | ⚠️ Performance Concern |
| 450  | -      | -    | -    | -      | -      | -         | ❌ Severe impact       |

_Note: Performance increases significantly beyond 400 members, which represents a hard limit on the protocol. Group creation operations scale with group size, while other operations remain relatively consistent regardless of member count._

### Network performance

| Performance Metric   | Current Performance | Target            | Status       |
| -------------------- | ------------------- | ----------------- | ------------ |
| Server Call Response | 78.4ms avg          | <100ms P95        | ✅ On Target |
| TLS Handshake        | 83.6ms avg          | <100ms P95        | ✅ On Target |
| Message Processing   | 212.5ms avg         | <300ms end-to-end | ✅ On Target |
| Geographic Variance  | 18.3% US-to-Non-US  | <20% difference   | ✅ On Target |

_Note: Performance metrics based on US testing on dev and production network. Geographic variance reflects US vs Non-US comparison._

### Regional Network Performance

| Region        | Server | TLS   | Difference from us-east | Status                 |
| ------------- | ------ | ----- | ----------------------- | ---------------------- |
| us-east       | 276.6  | 87.2  | Baseline                | ✅ On Target           |
| us-west       | 229.3  | 111.1 | -15.6%                  | ✅ On Target           |
| europe        | 178.5  | 111.4 | -33.2%                  | ✅ On Target           |
| asia          | 411.0  | 103.7 | +46.5%                  | ✅ On Target           |
| south-america | 754.6  | 573.1 | +160.3%                 | ⚠️ Performance Concern |

_Note: Regional performance testing shows significant latency increases in south-america (+160.3%) and asia (+46.5%) regions compared to the us-east baseline._

## 2. Message reliability

### Message delivery testing

| Test Area                             | Current Performance | Target                     | Status       |
| ------------------------------------- | ------------------- | -------------------------- | ------------ |
| Stream Delivery Rate                  | 100% successful     | 99.9% minimum              | ✅ On Target |
| Poll Delivery Rate                    | 100% successful     | 99.9% minimum              | ✅ On Target |
| Message Sequence Integrity in Streams | 100% in order       | 100% in correct order      | ✅ On Target |
| Message Sequence Integrity in Poll    | 100% in order       | 100% in correct order      | ✅ On Target |
| Offline Message Recovery              |                     | 100% recovery on reconnect | ⏳ WIP       |

_Note: Testing regularly in groups of 40 active members listening to one user sending 100 messages_

### Stream vs. Poll reliability

| Retrieval Method | Reliability   | Latency           | Use Case               | Status       |
| ---------------- | ------------- | ----------------- | ---------------------- | ------------ |
| Stream-based     | 100% delivery | Real-time         | Active conversations   | ✅ On Target |
| Poll-based       | 100% delivery | Delayed (30s max) | Backup/recovery        | ✅ On Target |
| Hybrid approach  | 100% delivery | Optimized         | Recommended for Agents | ✅ On Target |

_Note: A hybrid approach using streams with poll-based verification provides the most reliable message delivery guarantee._

## 3. Integration testing

### Cross-SDK Testing

| SDK Combination              | Test Focus                    | Status      |
| ---------------------------- | ----------------------------- | ----------- |
| Node SDK ↔ Node SDK         | Agent-to-Agent communication  | ✅ Verified |
| React Native ↔ React Native | Non- coinbase build           | ⏳ WIP      |
| React Native ↔ Node SDK     | Client-to-Agent communication | ⏳ WIP      |

_Note: Haven't been able to produce reports in cross- testing until we have access to both builds, ios/android_

## 4. Success criteria summary

| Metric                  | Current Performance        | Target                  | Status                |
| ----------------------- | -------------------------- | ----------------------- | --------------------- |
| Core SDK Operations     | All within targets         | Meet defined targets    | ✅ On Target          |
| Group Operations        | ≤400 members within target | <400 members hard limit | ✅ On Target          |
| Network Performance     | All metrics within target  | Meet defined targets    | ✅ On Target          |
| Message Delivery        | 100%                       | 99.9% minimum           | ✅ On Target          |
| Stream Message Loss     | 0.0%                       | 0% (zero tolerance)     | ✅ On Target          |
| Cross-SDK Compatibility | 80%                        | 100% operation success  | ⏳ WIP                |
| Non-us performance      | 40%                        | <20% difference         | ❌ Performance Impact |

## 🧪 Test Suites

Run tests for specific modules using these commands:

#### TS_Performance:

Measures operations in milliseconds and aggregates results in a Datadog dashboard

```bash
yarn test ts_performance
```

[View test source](./tests/TS_Performance.test.ts)

#### TS_Geolocation:

Measures geolocation of the library in the dev network

```bash
railway run -s xmtp-qa-testing:us-west yarn test ts_performance | tee logs/us-west-performance.log
```

[View test source](./tests/TS_Geolocation.test.ts)

#### TS_Delivery:

Tests multiple concurrent streams to detect any message losses

```bash
yarn test ts_delivery
```

[View test source](./tests/TS_Delivery.test.ts)

#### TS_Gm:

End-to-end testing for the Gm bot across browser and Node.js environments

```bash
yarn test ts_gm
```

[View test source](./tests/TS_Gm.test.ts)

## 👥 Workers

Predefined personas (Bob, Joe, Sam, etc.) are initialized with the `getWorkers` function:

```tsx
let personas: Record<string, Persona>;

beforeAll(async () => {
  personas = await getWorkers(["alice", "bob", "randomguy"], testName);
});

const bob = personas.get("bob");
```

See more in the [workers section](./WORKERS.md)

## 🤖 Test bots

A versatile bot for manual interaction testing:

```bash
yarn bot
```

Learn more in the [test bot section](./bots/test/)

## 📊 Datadog Dashboards

- **Message Delivery:** [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nzf?fromUser=false&p=1&from_ts=1741437030591&to_ts=1741440630591&live=true)
- **SDK Performance:** [Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/)

Explore more in the [dashboards section](./dashboards/)

## 🧰 Tools & Utilities

- **Helpers:** Utility functions in the [helpers section](./helpers/)
- **Scripts:** Automation scripts in the [scripts section](./scripts/)
- **Workflows:** See our CI/CD pipeline configuration in the [workflows section](/.github/workflows)
- **Bugs:** We document bugs in the [bugs folder](./bugs/) for easy reproduction and tracking.
- **Live Deployment:** We use Vitest for running tests with an interactive [UI](https://xmtp-qa-testing.up.railway.app/__vitest__/#/)
- Visit our Public [Railway project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- **QA Board:** Follow progress on the [QA Board](https://github.com/orgs/xmtp/projects/30)
- **Repo Issues:** Report bugs and feature requests in the [repo issues](https://github.com/xmtp/xmtp-qa-testing/issues)

## 🔨 Development

### Prerequisites

- Node.js (>20.18.0)
- Yarn

### Installation

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

### Use local network

- Install docker
- Run the local network

```bash
./dev/up
```

### Run tests

Example:

```bash
yarn test dms
```
