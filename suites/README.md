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

| Test Suite                      | Purpose                                       | Documentation                       |
| ------------------------------- | --------------------------------------------- | ----------------------------------- |
| **[functional](./functional/)** | Complete protocol functionality testing suite | [README.md](./functional/README.md) |

Includes: browser testing, client management, codec error handling, consent management, conversations, DMs, groups, installations, metadata, offline capabilities, message ordering, regression testing, streams, and sync performance.

## 🚀 Performance & Scale Test Suites

Performance measurement, scalability testing, and reliability validation with detailed metrics collection.

| Test Suite                                | Purpose                                         | Documentation                                |
| ----------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| **[large](./large/)**                     | Large group performance and scalability testing | [README.md](./large/README.md)               |
| **[delivery](./metrics/delivery/)**       | Message delivery reliability and ordering       | [README.md](./metrics/delivery/README.md)    |
| **[performance](./metrics/performance/)** | End-to-end operational performance              | [README.md](./metrics/performance/README.md) |

## 🔒 Security Test Suites

Security validation and threat testing for XMTP protocol implementations.

| Test Suite                  | Purpose                              | Documentation               |
| --------------------------- | ------------------------------------ | --------------------------- |
| **[security](./security/)** | Spam testing and security validation | [View tests →](./security/) |

## 🐛 Bug Documentation & Regression

Historical bug tracking, reproduction tests, and regression prevention.

| Test Suite                      | Purpose                                      | Documentation                       |
| ------------------------------- | -------------------------------------------- | ----------------------------------- |
| **[bugs](./bugs/)**             | Bug documentation and reproduction tests     | [README.md](./bugs/README.md)       |
| **[regression](./regression/)** | Historical bug reproduction and verification | [README.md](./regression/README.md) |

## 🔧 Other Test Suites

Additional manual and specialized testing suites for specific use cases.

| Test Suite                                  | Purpose                                    | Documentation                                |
| ------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| **[notifications](./other/notifications/)** | Push notification functionality validation | [README.md](./other/notifications/README.md) |
| **[other](./other/)**                       | Miscellaneous and specialized test cases   | [View tests →](./other/)                     |
