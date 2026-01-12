# XMTP qa tools

This monorepo contains a comprehensive collection of tools for testing and monitoring the XMTP protocol and its implementations.

## Automated workflowss

| Test suite  | Status                                                                                                                                                                                              | Resources                                                                                                                                                                                   | Run frequency    | Networks           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ |
| Performance | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml)                        | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/performance.test.ts)           | Every 2 hours    | `dev` `production` |
| Delivery    | [![Dev Delivery](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml)                             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/delivery.test.ts)                 | Every 2 hours    | `dev` `production` |
| Browser     | [![Browser](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml)                                    | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/functional/browser.test.ts)        | Every 2 hours    | `dev` `production` |
| Regression  | [![Regression testing](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/validate-regression.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/validate-regression.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/validate-regression.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/versions/validate-regression.yml) | After PR merge   | `dev`              |
| AgentGroups | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml)                        | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentGroups.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/agents/monitoring)                        | Every 3 hours    | `dev` `production` |
| AgentText   | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml)                            | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentText.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/agents/monitoring)                          | Every hour       | `production`       |
| AgentHealth | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml)                        | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/AgentHealth.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/agents/monitoring)                        | Every 10 minutes | `dev` `production` |

## Architecture

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
    nodeBindings["Node SDK"]
  end

  subgraph Applications["Applications"]
    webApps["xmtp.chat"]
    mobileApps["Native Apps"]
    crossPlatformApps["Cross-platform Apps"]
    messagingApps["Convos, Base"]
    botAgents["Bots & Agents"]
    backendServices["Backend Services"]
  end

  decentralNode["Decentralized<br>Nodes"] --> libxmtp["LibXMTP<br>(openmls)<br>(diesel)"]
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

  napi --- nodeBindings
  nodeBindings --- botAgents
  nodeBindings --- backendServices

  reactNativeSDK --- messagingApps
  napi -.- reactNativeSDK

  linkStyle 0,4,12,13 stroke:#f66,stroke-width:4px,stroke-dasharray: 5,5;
  classDef highlightStroke stroke:#f66,color:#c9d1d9,stroke-width:4px;
  class centralNode,libxmtp,webApps,messagingApps,botAgents highlightStroke;
```

> The highlighted path (red dashed line) in the architecture diagram shows our main testing focus.

`LibXMTP` is a shared library built in Rust and compiled to WASM, Napi, and FFI bindings. It encapsulates the core cryptography functions of the XMTP messaging protocol. Due to the complexity of the protocol, we are using `openmls` as the underlying cryptographic library, it's important to test how this bindings perform in their own language environments.

We can test all XMTP bindings using three main applications. We use [xmtp.chat](https://xmtp.chat/) to test the Browser SDK's Wasm binding in actual web environments. We use [Convos](https://github.com/ephemeraHQ/converse-app) to test the React Native SDK, which uses both Swift and Kotlin FFI bindings for mobile devices. We use [agents](https://github.com/ephemeraHQ/xmtp-agent-examples) to test the Node SDK's Napi binding for server functions. This testing method checks the entire protocol across all binding types, making sure different clients work together, messages are saved, and users have the same experience across the XMTP system.

#### Test coverage summary

- Protocol: DMs, groups, streams, sync, consent, client, codecs, installations, agents
- Performance: Benchmarking, reliability, mid-scale testing
- Compatibility: Backward compatibility across last +5 `node-sdk` versions.
- Production: Agent monitoring, security, concurrency, spam detection, rate limiting
- Automation: CI workflows with Datadog metrics, Slack alerting, browser log analysis
- Delivery: Delivery and order rate, response times.
- Network: Chaos network, latency, black hole, etc.
- Infrastructure: Multi-region testing across US, Europe, Asia, South America.

## Documentation

- Monitoring: E2E tests, metrics tracking, and alerting - see [section](./monitoring/README.md)
- Measurements: Performance metrics and targets - see [section](./measurements/README.md)
- Agents: Agent QA & monitoring - see [section](./agents/README.md)
- Network: Network chaos testing - see [section](./networkchaos/README.md)
- Forks: Probabilistic fork testing - see [section](./forks/README.md)
- Version management: How to manage SDK and bindings versions - see [section](./workers/README.md)
- CLI: Command line interface for testing - see [section](./cli/readme.md)

## Tools & utilities

- Status: XMTP network status - [see section](https://status.xmtp.org/)
- Dashboard: Performance and monitoring datadog dashboard - [see section](https://p.datadoghq.com/sb/a5c739de-7e2c-11ec-bc0b-da7ad0900002-efaf10f4988297b8a8581128f2867a3d)
- Logging: Datadog error logging - [see section](https://app.datadoghq.com/logs?saved-view-id=3577190)
- Schedule: Scheduled workflows - [see section](https://github.com/xmtp/xmtp-qa-tools/actions?query=event:schedule)
- Railway: Multi-region services - [see section](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- Bots: Bots for testing with multiple agents - [see section](https://github.com/xmtp/xmtp-qa-tools/tree/main/bots/)
- Claude Code ai assistant for XMTP - [see section](./copilot/CLAUDE.md)
- Railway download db server - [see section](./db-backups/README.md)

## Development

#### Prerequisites

- Node.js (>20.18.0)
- Yarn 4.6.0

#### Installation

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

#### Environment variables

```bash
XMTP_ENV="dev" #  environment (dev, production, local, multinode)
LOGGING_LEVEL="error" # Rust library logs
LOG_LEVEL="info" # JS logs level
```

### Running tests

To get started set up the environment in [variables](./.env.example) and run the tests with:

```bash
yarn test performance --env dev
```

#### Debug mode

```bash
yarn test performance --no-fail --log warn --file
```

> This will save logs to `logs/` directory and will not print to the terminal.

### Resources

- Test suites: Test suites directory - [see section](https://github.com/xmtp/xmtp-qa-tools/tree/main/monitoring/)
- Inboxes: Inboxes for testing - [see section](/inboxes/)
- Networks: Work in [local](/dev/) or [multinode](/dev/multinode) network
- Workers: Worker for testing with CLI - [see section](/workers/)
- Helpers: Coding helpers - [see section](/helpers/)

##### Rate limits

- Read operations: 20,000 requests per 5-minute window
- Write operations: 3,000 messages published per 5-minute window

##### Endpoints

- `local`: `http://localhost:5556`
- `dev`: `https://grpc.dev.xmtp.network:443`
- `production`: `https://grpc.production.xmtp.network:443`
