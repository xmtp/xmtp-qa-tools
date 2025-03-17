# XMTP QA Testing Suite

## Overview

This monorepo contains a comprehensive collection of tools for testing and monitoring the XMTP protocol and its implementations.

| Test Suite     | Dev Network Status                                                                                                                                                                     | Production Network Status                                                                                                                                                                                   | Run frequency |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 🚀 Performance | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml) | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml) | Every 30 min  |
| 📬 Delivery    | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml)       | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml)       | Every 30 min  |
| 👋 Gm          | [![TS_Gm_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml)             | [![TS_Gm_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml)             | Every 30 min  |
| 🌎 Geolocation | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml) | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml) | Every 30 min  |

## Testing scope

### Architecture

This flowchart illustrates the XMTP protocol's layered architecture and testing scope:

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#0D1117', 'primaryTextColor': '#c9d1d9', 'primaryBorderColor': '#30363d', 'lineColor': '#8b949e', 'secondaryColor': '#161b22', 'tertiaryColor': '#161b22' }}}%%

flowchart LR
  %% Core components and bindings
  subgraph Bindings["Bindings"]
    wasm["WASM"]
    ffi["FFI"]
    napi["Napi"]
  end

  subgraph SDKs["SDKs"]
    browserSDK["Browser SDK"]
    swiftSDK["Swift SDK"]
    kotlinSDK["Kotlin SDK"]
    reactNativeSDK["React Native SDK"]
    nodesdk["Node SDK"]
  end

  subgraph Applications["Applications"]
    webApps["xmtp.chat"]
    mobileApps["Native Apps"]
    crossPlatformApps["Cross-platform Apps"]
    messagingApps["Convos"]
    botAgents["Bots & Agents"]
    backendServices["Backend Services"]
  end

  centralNode["Node"] --> libxmtp["LibXMTP<br>(openmls)<br>(diesel)"]
  libxmtp --- wasm
  libxmtp --- ffi
  kotlinSDK --- mobileApps
  libxmtp --- napi

  wasm --- browserSDK
  ffi --- swiftSDK
  ffi --- kotlinSDK

  swiftSDK --- reactNativeSDK
  kotlinSDK --- reactNativeSDK

  browserSDK --- webApps

  swiftSDK --- mobileApps

  napi --- nodesdk
  nodesdk --- botAgents
  nodesdk --- backendServices

  decentralNode["Decentralized Nodes"] -.- libxmtp


  reactNativeSDK --- messagingApps
  napi -.- reactNativeSDK

  linkStyle 0,4,12,13 stroke:#f66,stroke-width:4px,stroke-dasharray: 5,5;
  classDef highlightStroke stroke:#f66,color:#c9d1d9,stroke-width:4px;
  class centralNode,libxmtp,webApps,messagingApps,botAgents highlightStroke;
```

> The highlighted path (red dashed line) in the architecture diagram shows our main testing focus.

`LibXMTP` is a shared library built in Rust and compiled to WASM, Napi, and FFI bindings. It encapsulates the core cryptography functions of the XMTP messaging protocol. Due to the complexity of the protocol, we are using `openmls` as the underlying cryptographic library, it's important to test how this bindings perform in their own language environments.

We can test all XMTP bindings using three main applications. We use xmtp.chat to test the Browser SDK's Wasm binding in actual web environments. We use Convos to test the React Native SDK, which uses both Swift and Kotlin FFI bindings for mobile devices. We use agents to test the Node SDK's Napi binding for server functions. This testing method checks the entire protocol across all binding types, making sure different clients work together, messages are saved, and users have the same experience across the XMTP system.

### Testing details

- Multi-region testing nodes (`us-east`, `us-west` , `asia`, `europe` )
- 30-minute automated test execution intervals
- Comprehensive data aggregation in datadog
- Testing directly on top of SDKs for real-world scenarios
- `dev` and `production` network covered
- Automated testing for web app `xmtp.chat`
- Manual testing for react native app
- Human & agents testing for real-world simulations

### TLDR: Metrics

- **Core SDK Performance**: Direct message creation (<500ms), group operations (<200-500ms)
- **Network Performance**: Server call (<100ms), TLS handshake (<100ms), total processing (<300ms)
- **Group Scaling**: Supports up to 300 members efficiently (create: 9s, operations: <350ms)
- **Regional Performance**: US/Europe optimal, Asia/South America higher latency (+46-160%)
- **Message Reliability**: 100% delivery rate (target: 99.9%), perfect ordering
- **Environments**: Production consistently outperforms Dev network by 5-9%

## Operation performance

### Core SDK Operations Performance

| Operation           | Description                            | Avg (ms) | Target | Status       |
| ------------------- | -------------------------------------- | -------- | ------ | ------------ |
| createDM            | Creating a direct message conversation | 254-306  | <500ms | ✅ On Target |
| sendGM              | Sending a group message                | 123-132  | <200ms | ✅ On Target |
| receiveGM           | Receiving a group message              | 90-94    | <200ms | ✅ On Target |
| receiveGroupMessage | Processing group message streams       | 119-127  | <200ms | ✅ On Target |
| updateGroupName     | Updating group metadata                | 105-108  | <200ms | ✅ On Target |
| syncGroup           | Syncing group state                    | 78-89    | <200ms | ✅ On Target |
| addMembers          | Adding participants to a group         | 238-280  | <500ms | ✅ On Target |
| removeMembers       | Removing participants from a group     | 147-168  | <300ms | ✅ On Target |
| inboxState          | Checking inbox state                   | 36       | <100ms | ✅ On Target |

_Note: Based on data from 79 measured operations in the `us-east` region and `production` network._

### Group Operations Performance by Size

| Size | Create(ms) | Send(ms) | Sync(ms) | Update(ms) | Remove(ms) | Target(Create) | Status                 |
| ---- | ---------- | -------- | -------- | ---------- | ---------- | -------------- | ---------------------- |
| 50   | 990        | 71       | 61       | 81         | 140        | <2,000ms       | ✅ On Target           |
| 100  | 1,599      | 67       | 66       | 91         | 182        | <2,000ms       | ✅ On Target           |
| 150  | 2,956      | 72       | 85       | 104        | 183        | <4,000ms       | ✅ On Target           |
| 200  | 4,598      | 73       | 103      | 139        | 211        | <5,000ms       | ✅ On Target           |
| 250  | 5,983      | 76       | 120      | 164        | 234        | <7,000ms       | ✅ On Target           |
| 300  | 8,707      | 81       | 321      | 255        | 309        | <9,000ms       | ✅ On Target           |
| 350  | 9,826      | 79       | 132      | 228        | 368        | <11,000ms      | ⚠️ Performance Concern |
| 400  | 11,451     | 84       | 170      | 427        | 501        | <15,000ms      | ⚠️ Performance Concern |
| 450  | -          | -        | -        | -          | -          | -              | ❌ Severe impact       |

_Note: Performance increases significantly beyond `350` members, which represents a hard limit on the protocol._

## Networks performance

### Network performance

| Performance Metric   | Current Performance | Target            | Status       |
| -------------------- | ------------------- | ----------------- | ------------ |
| Server Call Response | 78.4ms avg          | <100ms            | ✅ On Target |
| TLS Handshake        | 83.6ms avg          | <100ms            | ✅ On Target |
| Message Processing   | 212.5ms avg         | <300ms end-to-end | ✅ On Target |

_Note: Performance metrics based on `us-east` testing on dev and production network._

### Regional Network Performance

| Region        | Server Call (ms) | TLS (ms) | ~ us-east | Status                 |
| ------------- | ---------------- | -------- | --------- | ---------------------- |
| us-east       | 276.6            | 87.2     | Baseline  | ✅ On Target           |
| us-west       | 229.3            | 111.1    | -15.6%    | ✅ On Target           |
| europe        | 178.5            | 111.4    | -33.2%    | ✅ On Target           |
| asia          | 411.0            | 103.7    | +46.5%    | ⚠️ Performance Concern |
| south-america | 754.6            | 573.1    | +160.3%   | ⚠️ Performance Concern |

_Note: Baseline is `us-east` region and `production` network._

### Dev vs Production Network Performance Comparison

| Region        | Dev (ms) | Production (ms) | Difference | Status               |
| ------------- | -------- | --------------- | ---------- | -------------------- |
| us-east       | 294.8    | 276.6           | -6.2%      | ✅ Production Better |
| us-west       | 247.1    | 229.3           | -7.2%      | ✅ Production Better |
| europe        | 196.3    | 178.5           | -9.1%      | ✅ Production Better |
| asia          | 439.8    | 411.0           | -6.5%      | ✅ Production Better |
| south-america | 798.2    | 754.6           | -5.5%      | ✅ Production Better |

_Note: `Production` network consistently shows better network performance across all regions, with improvements ranging from 5.5% to 9.1%._

## Message reliability

### Message delivery testing

| Test Area              | Current Performance | Target          | Status       |
| ---------------------- | ------------------- | --------------- | ------------ |
| Stream Delivery Rate   | 100% successful     | 99.9% minimum   | ✅ On Target |
| Poll Delivery Rate     | 100% successful     | 99.9% minimum   | ✅ On Target |
| Stream Order           | 100% in order       | 100% in order   | ✅ On Target |
| Poll Order             | 100% in order       | 100% in order   | ✅ On Target |
| Offline Recovery Rate  | 100% successful     | 100% successful | ✅ On Target |
| Offline Recovery Order | 100% in order       | 100% in order   | ✅ On Target |

_Note: Testing regularly in groups of `40` active members listening to one user sending 100 messages_

### Stream vs. Poll reliability

| Retrieval Method | Reliability   | Latency           | Use Case               | Status       |
| ---------------- | ------------- | ----------------- | ---------------------- | ------------ |
| Stream-based     | 100% delivery | Real-time         | Active conversations   | ✅ On Target |
| Poll-based       | 100% delivery | Delayed (30s max) | Backup/recovery        | ✅ On Target |
| Hybrid approach  | 100% delivery | Optimized         | Recommended for Agents | ✅ On Target |

_Note: A hybrid approach using `stream` and `poll`-based verification provides the most reliable message delivery guarantee._

### Success criteria summary

| Metric               | Current Performance         | Target                 | Status                 |
| -------------------- | --------------------------- | ---------------------- | ---------------------- |
| Core SDK Operations  | All within targets          | Meet defined targets   | ✅ On Target           |
| Group Operations     | ≤300 members                | ≤300 members on target | ✅ On Target           |
| Network Performance  | All metrics within target   | Meet defined targets   | ✅ On Target           |
| Message Delivery     | 100%                        | 99.9% minimum          | ✅ On Target           |
| Stream Message Loss  | 100%                        | 99.9% minimum          | ✅ On Target           |
| Poll Message Loss    | 100%                        | 99.9% minimum          | ✅ On Target           |
| Message Order        | 100%                        | 100% in order          | ✅ On Target           |
| South-america & Asia | more than 40%               | <20% difference        | ⚠️ Performance Concern |
| US & Europe          | less than 20% variance      | <20% difference        | ✅ On Target           |
| Dev vs Production    | Production 4.5-16.1% better | Production ≥ Dev       | ✅ On Target           |

### Disclaimers

- **Ideal Network Conditions**: Real-world performance may vary significantly when the network is under stress or high load.
- **Node-sdk only**: Metrics are based on node-sdk only operations and are not covering performance across all SDKs.
- **Pre-Release Status**: This assessment reflects the current development version targeting the `4.0.0` stable release. Optimizations and improvements are ongoing.

## Other

### Cross-SDK Testing

| SDK Combination          | Test Focus                    | Status      |
| ------------------------ | ----------------------------- | ----------- |
| Node SDK ↔ Node SDK     | Agent-to-Agent communication  | ✅ Verified |
| Web ↔ Node SDK          | Client-to-Agent communication | ✅ Verified |
| React Native ↔ Node SDK | Client-to-Agent communication | ✅ Verified |

_Note: Cross-SDK was tested using the `operations` describe above and is not covering all edge cases._

### Package Manager Test Results

| Package Manager | Node 20 | Node 21 | Node 22 | Node 23 |
| --------------- | ------- | ------- | ------- | ------- |
| pnpm            | ✅      | ✅      | ✅      | ✅      |
| npm             | ✅      | ✅      | ✅      | ✅      |
| yarn@4.6.0      | ✅      | ✅      | ✅      | ✅      |
| yarn@1.22.19    | ✅      | ✅      | ✅      | ✅      |
| bun             | ✅      | ✅      | ✅      | ✅      |

## Tools & Utilities

- **Repository:** [xmtp-qa-testing](https://github.com/xmtp/xmtp-qa-testing): This monorepo contains multiple tools for testing and monitoring
- **Test bot:** Bot for testing with multiple agents - [see section](https://github.com/xmtp/xmtp-qa-testing/tree/main/bots/test/)
- **Workflows:** See our CI/CD pipeline configuration - [see section](https://github.com/xmtp/xmtp-qa-testing/tree/main/.github/workflows)
- **Vitest:** We use Vitest for running tests with an interactive UI - [see section](https://xmtp-qa-testing.up.railway.app/__vitest__/#/)
- **Railway:** Visit our Railway project with all our services - [see section](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- **Gm bot:** Bot for testing with older version of the protocol - [see section](https://github.com/xmtp/gm-bot)

## Development

### Prerequisites

- Node.js (>20.18.0)
- Yarn 4.6.0

### Installation

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

### Resources

- **Local:** Work in local network with [dev section](/dev/)
- **Workers:** Predefined workers like `bob`, `alice`, `randomguy` with [workers](/workers/)
- **Helpers:** Utility functions in the [helpers section](/helpers/)
- **Scripts:** Automation scripts in the [scripts section](/scripts/)
