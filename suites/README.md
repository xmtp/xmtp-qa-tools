# Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

## Overview

This directory contains six main categories of test suites:

- **Automated** - Continuous integration tests for production systems
- **Functional** - Core XMTP protocol functionality tests
- **Manual** - Human-operated tests for specific scenarios
- **Metrics** - Performance and reliability measurement tests
- **Large** - Large-scale operations and scalability testing
- **Bugs** - Bug reproduction and regression testing

## 🤖 Automated Test Suites

Tests that run automatically on CI/CD pipelines to monitor production systems.

| Test Suite     | Purpose                                             | Documentation                                            |
| -------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **agents**     | Health monitoring of production XMTP agents         | [agents/README.md](./automated/agents/README.md)         |
| **gm**         | Validation of GM bot and browser integration        | [gm/README.md](./automated/gm/README.md)                 |
| **not-forked** | Group membership and message forking stress testing | [not-forked/README.md](./automated/not-forked/README.md) |

## ⚙️ Functional Test Suites

Core XMTP protocol functionality validation with comprehensive test coverage.

| Test Suite        | Purpose                                     | Documentation    |
| ----------------- | ------------------------------------------- | ---------------- |
| **browser**       | Browser environment compatibility testing   | Direct test file |
| **clients**       | Client initialization and lifecycle testing | Direct test file |
| **codec**         | Content type and codec functionality        | Direct test file |
| **consent**       | Contact consent and preference management   | Direct test file |
| **dms**           | Direct message functionality                | Direct test file |
| **downgrade**     | Protocol version downgrade handling         | Direct test file |
| **groups**        | Group conversation operations               | Direct test file |
| **installations** | Multi-installation client management        | Direct test file |
| **metadata**      | Conversation and message metadata handling  | Direct test file |
| **offline**       | Offline mode and sync behavior              | Direct test file |
| **order**         | Message ordering and consistency            | Direct test file |
| **streams**       | Real-time message streaming                 | Direct test file |
| **sync**          | Conversation and message synchronization    | Direct test file |

## 🔧 Manual Test Suites

Human-operated tests for investigating specific issues or running regression tests.

| Test Suite        | Purpose                                      | Documentation                                               |
| ----------------- | -------------------------------------------- | ----------------------------------------------------------- |
| **notifications** | Push notification functionality validation   | [notifications/README.md](./manual/notifications/README.md) |
| **regression**    | Historical bug reproduction and verification | [regression/README.md](./manual/regression/README.md)       |
| **spam**          | Spam detection and filtering testing         | Direct test directory                                       |
| **stress-bot**    | Bot performance under stress conditions      | Direct test file                                            |
| **large-group**   | Large group operations and edge cases        | Direct test file                                            |
| **rate-limited**  | Rate limiting behavior validation            | Direct test file                                            |

## 📊 Metrics Test Suites

Performance measurement and reliability testing with detailed metrics collection.

| Test Suite      | Purpose                                   | Documentation                                            |
| --------------- | ----------------------------------------- | -------------------------------------------------------- |
| **delivery**    | Message delivery reliability and ordering | [delivery/README.md](./metrics/delivery/README.md)       |
| **performance** | End-to-end operational performance        | [performance/README.md](./metrics/performance/README.md) |

## 📈 Large-Scale Test Suites

High-volume operations and scalability testing for enterprise use cases.

| Test Suite           | Purpose                                    | Documentation                        |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| **conversations**    | Large-scale conversation management        | [large/README.md](./large/README.md) |
| **messages**         | High-volume message processing             | Direct test file                     |
| **metadata**         | Metadata operations at scale               | Direct test file                     |
| **membership**       | Large group membership operations          | Direct test file                     |
| **syncs**            | Large-scale synchronization performance    | Direct test file                     |
| **cumulative_syncs** | Cumulative sync operations and performance | Direct test file                     |

## 🐛 Bug Test Suites

Bug reproduction, regression testing, and issue documentation.

| Test Suite      | Purpose                              | Documentation                      |
| --------------- | ------------------------------------ | ---------------------------------- |
| **bug_stitch**  | Stitch-related issue reproduction    | [bugs/README.md](./bugs/README.md) |
| **bug_panic**   | Panic error reproduction and testing | [bugs/README.md](./bugs/README.md) |
| **bug_kpke**    | KPKE-related bug testing             | [bugs/README.md](./bugs/README.md) |
| **bug_welcome** | Welcome message issue testing        | [bugs/README.md](./bugs/README.md) |
| **other**       | Miscellaneous bug investigations     | Direct test directory              |

## 🏃‍♂️ Quick Start

### Prerequisites

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

### Running Specific Test Suites

```bash
# Automated tests
yarn test agents
yarn test gm
yarn test not-forked

# Functional tests
yarn test dms
yarn test groups
yarn test streams
yarn test sync

# Manual tests
yarn test notifications
yarn test regression
yarn test stress-bot
yarn test large-group
yarn test rate-limited

# Metrics tests
yarn test delivery
yarn test performance

# Large-scale tests
yarn test conversations
yarn test messages
yarn test syncs
```

## 📝 Naming Conventions

### Test Files

- **Automated**: `{suite-name}.test.ts` (e.g., `agents.test.ts`)
- **Functional**: `{feature-name}.test.ts` (e.g., `dms.test.ts`)
- **Manual**: `{suite-name}.test.ts` (e.g., `notifications.test.ts`)
- **Metrics**: `{suite-name}.test.ts` (e.g., `delivery.test.ts`)
- **Large**: `{operation-type}.test.ts` (e.g., `conversations.test.ts`)
- **Bugs**: `bug_{type}` directories with test files

### Test Names

- Use kebab-case for test identifiers
- Include category prefix in describe() blocks
- Example: `describe("dms", ...)`, `describe("delivery", ...)`

### Directory Structure

```
suites/
├── automated/          # CI/CD integrated tests
│   ├── agents/
│   ├── gm/
│   └── not-forked/
├── functional/         # Core protocol functionality
│   ├── browser.test.ts
│   ├── clients.test.ts
│   ├── dms.test.ts
│   ├── groups.test.ts
│   └── ...
├── manual/            # Human-operated tests
│   ├── notifications/
│   ├── regression/
│   ├── spam/
│   ├── stress-bot/
│   ├── large-group.test.ts
│   └── rate-limited.test.ts
├── metrics/           # Performance measurement
│   ├── delivery/
│   └── performance/
├── large/             # Large-scale operations
│   ├── conversations.test.ts
│   ├── messages.test.ts
│   ├── syncs.test.ts
│   └── ...
└── bugs/              # Bug reproduction
    ├── bug_stitch/
    ├── bug_panic/
    ├── bug_kpke/
    ├── bug_welcome/
    └── other/
```
