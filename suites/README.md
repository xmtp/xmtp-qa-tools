# Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

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

| Test Suite                                  | Purpose                                      | Documentation                                |
| ------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| **[notifications](./other/notifications/)** | Push notification functionality validation   | [README.md](./other/notifications/README.md) |
| **[regression](./other/regression/)**       | Historical bug reproduction and verification | [README.md](./other/regression/README.md)    |
| **[spam](./other/spam/)**                   | Spam detection and filtering testing         | [View tests →](./other/spam/)                |

## 📊 Metrics Test Suites

Performance measurement and reliability testing with detailed metrics collection.

| Test Suite                                | Purpose                                   | Documentation                                |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| **[delivery](./metrics/delivery/)**       | Message delivery reliability and ordering | [README.md](./metrics/delivery/README.md)    |
| **[performance](./metrics/performance/)** | End-to-end operational performance        | [README.md](./metrics/performance/README.md) |
