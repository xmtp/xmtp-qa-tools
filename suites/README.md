# Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

## Overview

This directory contains four main categories of test suites:

- **Automated** - Continuous integration tests for production systems
- **Manual** - Human-operated tests for specific scenarios
- **Metrics** - Performance and reliability measurement tests
- **Stress** - High-load and edge-case testing

## 🤖 Automated Test Suites

Tests that run automatically on CI/CD pipelines to monitor production systems.

| Test Suite | Purpose                                      | Status    | Documentation                                    |
| ---------- | -------------------------------------------- | --------- | ------------------------------------------------ |
| **agents** | Health monitoring of production XMTP agents  | ✅ Active | [agents/README.md](./automated/agents/README.md) |
| **gm**     | Validation of GM bot and browser integration | ✅ Active | [gm/README.md](./automated/gm/README.md)         |

## 🔧 Manual Test Suites

Human-operated tests for investigating specific issues or running regression tests.

| Test Suite        | Purpose                                      | Status    | Documentation                                               |
| ----------------- | -------------------------------------------- | --------- | ----------------------------------------------------------- |
| **notifications** | Push notification functionality validation   | ⚠️ Manual | [notifications/README.md](./manual/notifications/README.md) |
| **regression**    | Historical bug reproduction and verification | ⚠️ Manual | [regression/README.md](./manual/regression/README.md)       |

## 📊 Metrics Test Suites

Performance measurement and reliability testing with detailed metrics collection.

| Test Suite      | Purpose                                   | Status     | Documentation                                            |
| --------------- | ----------------------------------------- | ---------- | -------------------------------------------------------- |
| **delivery**    | Message delivery reliability and ordering | 📈 Metrics | [delivery/README.md](./metrics/delivery/README.md)       |
| **large**       | Large-scale group operations performance  | 📈 Metrics | [large/README.md](./metrics/large/README.md)             |
| **performance** | End-to-end operational performance        | 📈 Metrics | [performance/README.md](./metrics/performance/README.md) |

## 🚨 Stress Test Suites

High-load testing and edge-case scenario validation.

| Test Suite       | Purpose                                             | Status    | Documentation                                                    |
| ---------------- | --------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| **group-stress** | Group membership and message forking stress testing | 🔥 Stress | [stress/group-stress/README.md](./stress/group-stress/README.md) |
| **rate-limited** | Rate limiting behavior validation                   | 🔥 Stress | Direct test file                                                 |
| **bot-stress**   | Bot performance under high load                     | 🔥 Stress | Direct test file                                                 |
| **large-group**  | 200+ member group operations                        | 🔥 Stress | Direct test file                                                 |

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

# Manual tests
yarn test notifications
yarn test regression

# Metrics tests
yarn test delivery
yarn test large
yarn test performance

# Stress tests
yarn test group-stress
yarn test rate-limited
yarn test bot-stress
yarn test large-group
```

## 📝 Naming Conventions

### Test Files

- **Automated**: `{suite-name}.test.ts` (e.g., `agents.test.ts`)
- **Manual**: `{suite-name}.test.ts` (e.g., `notifications.test.ts`)
- **Metrics**: `{suite-name}.test.ts` (e.g., `delivery.test.ts`)
- **Stress**: `{descriptive-name}.test.ts` (e.g., `group-stress.test.ts`)

### Test Names

- Use kebab-case for test identifiers
- Include category prefix in describe() blocks
- Example: `describe("agents", ...)`, `describe("delivery", ...)`

### Directory Structure

```
suites/
├── automated/           # CI/CD integrated tests
│   ├── agents/
│   └── gm/
├── manual/             # Human-operated tests
│   ├── notifications/
│   └── regression/
├── metrics/           # Performance measurement
│   ├── delivery/
│   ├── large/
│   └── performance/
└── stress/           # High-load testing
    ├── group-stress/
    ├── rate-limited.test.ts
    ├── bot-stress.test.ts
    └── large-group.test.ts
```

## 🔍 Contributing

When adding new test suites:

1. **Choose the right category** based on test purpose
2. **Follow naming conventions** for consistency
3. **Create comprehensive README** using the established template
4. **Add entry to this main README** with proper categorization
5. **Include proper test lifecycle** with setupTestLifecycle helper

## 📚 Additional Resources

- [Workers Documentation](../workers/README.md)
- [Helpers Documentation](../helpers/README.md)
- [XMTP Node SDK Documentation](https://github.com/xmtp/xmtp-node-js-sdk)
