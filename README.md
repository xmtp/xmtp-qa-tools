# ✅ XMTP QA Testing Suite

This monorepo contains a comprehensive collection of tools for testing and monitoring the XMTP protocol and its implementations.

| Test Suite     | Dev Network Status                                                                                                                                                                                    | Production Network Status                                                                                                                                                                                                  | Run frequency |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 🚀 Performance | [![TS_Performance_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml) | [![TS_Performance_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml) | Every 30 min  |
| 📬 Delivery    | [![TS_Delivery_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml)          | [![TS_Delivery_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml)          | Every 30 min  |
| 👋 Gm          | [![TS_Gm_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml)                            | [![TS_Gm_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml)                            | Every 30 min  |
| 🌎 Geolocation | [![TS_Geolocation_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml) | [![TS_Geolocation_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml) | Every 30 min  |

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

![](/media/ts_performance.png)

- **Message Delivery:** [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nzf?fromUser=false&p=1&from_ts=1741437030591&to_ts=1741440630591&live=true)
- **SDK Performance:** [Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/)

Explore more in the [dashboards section](./dashboards/)

## 🧰 Tools & Utilities

- **Helpers:** Utility functions in the [helpers section](./helpers/)
- **Scripts:** Automation scripts in the [scripts section](./scripts/)
- **Workflows:** See our CI/CD pipeline configuration in the [workflows section](/.github/workflows)
- **Bugs:** We document bugs in the [bugs folder](./bugs/) for easy reproduction and tracking.
- **Related Repos:**
  - [libxmtp](https://github.com/xmtp/libxmtp) - Core library implementation
  - [node-sdk](https://github.com/xmtp/xmtp-js/tree/d7908ad96186026f081309ceb5c608279aab24a5/sdks/node-sdk) - Node.js SDK
  - [react-native-sdk](https://github.com/xmtp/xmtp-react-native) - React Native implementation
- **Live Deployment:** We use Vitest for running tests with an interactive [UI](https://xmtp-qa-testing.up.railway.app/__vitest__/#/)
- Visit our Public [Railway project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- **QA Board:** Follow our progress on the [QA Board](https://github.com/orgs/xmtp/projects/30)
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
