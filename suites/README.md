# Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

## Overview

This directory contains six main categories of test suites:

- **[Automated](./automated/)** - Continuous integration tests for production systems
- **[Functional](./functional/)** - Core XMTP protocol functionality tests
- **[Manual](./manual/)** - Human-operated tests for specific scenarios
- **[Metrics](./metrics/)** - Performance and reliability measurement tests
- **[Large](./large/)** - Large-scale operations and scalability testing
- **[Bugs](./bugs/)** - Bug reproduction and regression testing

## 🤖 Automated Test Suites

Tests that run automatically on CI/CD pipelines to monitor production systems.

| Test Suite                        | Purpose                                             | Documentation                             |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| **[agents](./automated/agents/)** | Health monitoring of production XMTP agents         | [README.md](./automated/agents/README.md) |
| **[gm](./automated/gm/)**         | Validation of GM bot and browser integration        | [README.md](./automated/gm/README.md)     |
| **[group ](./automated/group/)**  | Group membership and message forking stress testing | [README.md](./automated/group/README.md)  |

## ⚙️ Functional Test Suites

Core XMTP protocol functionality validation with comprehensive test coverage.

[View all functional tests →](./functional/)

## 🔧 Manual Test Suites

Human-operated tests for investigating specific issues or running regression tests.

| Test Suite                                   | Purpose                                      | Documentation                                 |
| -------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| **[notifications](./manual/notifications/)** | Push notification functionality validation   | [README.md](./manual/notifications/README.md) |
| **[regression](./manual/regression/)**       | Historical bug reproduction and verification | [README.md](./manual/regression/README.md)    |
| **[spam](./manual/spam/)**                   | Spam detection and filtering testing         | [View tests →](./manual/spam/)                |

## 📊 Metrics Test Suites

Performance measurement and reliability testing with detailed metrics collection.

| Test Suite                                | Purpose                                   | Documentation                                |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| **[delivery](./metrics/delivery/)**       | Message delivery reliability and ordering | [README.md](./metrics/delivery/README.md)    |
| **[performance](./metrics/performance/)** | End-to-end operational performance        | [README.md](./metrics/performance/README.md) |

## 📈 Large-Scale Test Suites

High-volume operations and scalability testing for enterprise use cases.

[View all large-scale tests →](./large/)

## 🐛 Bug Test Suites

Bug reproduction, regression testing, and issue documentation.

[View all bug tests →](./bugs/) | [Documentation](./bugs/README.md)

## 🏃‍♂️ Quick Start

### Prerequisites

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

### Running Test Suites

```bash
# Run tests by category
yarn test automated/
yarn test functional/
yarn test manual/
yarn test metrics/
yarn test large/
yarn test bugs/

# Run specific test suites
yarn test dms
yarn test groups
yarn test streams
yarn test sync
```
