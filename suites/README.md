# Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

## 🤖 Automated Test Suites

Tests that run automatically on CI/CD pipelines to monitor production systems.

| Test Suite                        | Purpose                                      | Documentation                             |
| --------------------------------- | -------------------------------------------- | ----------------------------------------- |
| **[agents](./automated/agents/)** | Health monitoring of production XMTP agents  | [README.md](./automated/agents/README.md) |
| **[gm](./automated/gm/)**         | Validation of GM bot and browser integration | [README.md](./automated/gm/README.md)     |

## ⚙️ Functional Test Suites

Core XMTP protocol functionality validation with comprehensive test coverage.

| Test Suite                      | Purpose                                       | Documentation                       |
| ------------------------------- | --------------------------------------------- | ----------------------------------- |
| **[functional](./functional/)** | Complete protocol functionality testing suite | [README.md](./functional/README.md) |

Includes: browser testing, client management, codec error handling, consent management, conversations, DMs, groups, installations, metadata, offline capabilities, message ordering, streams, and sync performance.

## 🔄 Group & Conversation Test Suites

Specialized testing for group conversations, membership management, and conversation forking scenarios.

| Test Suite            | Purpose                                             | Documentation                  |
| --------------------- | --------------------------------------------------- | ------------------------------ |
| **[group](./group/)** | Group conversation forking and stress testing suite | [README.md](./group/README.md) |

Features: Multi-version testing, membership change cycles, group metadata updates, admin permissions, message streams, concurrent workers, and rate limiting validation.

## 🚀 Performance & Scale Test Suites

Performance measurement, scalability testing, and reliability validation with detailed metrics collection.

| Test Suite                | Purpose                                              | Documentation                    |
| ------------------------- | ---------------------------------------------------- | -------------------------------- |
| **[large](./large/)**     | Large-scale performance and scalability testing      | [README.md](./large/README.md)   |
| **[metrics](./metrics/)** | Message delivery reliability and performance metrics | [README.md](./metrics/README.md) |
| **[mobile](./mobile/)**   | Mobile application performance under load testing    | [README.md](./mobile/README.md)  |
| **[storage](./storage/)** | Storage efficiency analysis across group sizes       | [README.md](./storage/README.md) |

### Performance Test Details

- **Large Suite**: Cumulative syncs, membership management, message handling, metadata operations, conversation management
- **Metrics Suite**: End-to-end delivery testing and operational performance measurement
- **Mobile Suite**: Performance degradation testing under various load configurations (Small/Medium/Large/XL)
- **Storage Suite**: Storage cost analysis and efficiency gains measurement across different group sizes

## 🔒 Security & Spam Test Suites

Security validation, spam testing, and threat prevention for XMTP protocol implementations.

| Test Suite          | Purpose                              | Documentation                 |
| ------------------- | ------------------------------------ | ----------------------------- |
| **[spam](./spam/)** | Spam testing and security validation | [README.md](./spam/README.md) |

## 🐛 Bug Documentation & Regression

Historical bug tracking, reproduction tests, and regression prevention.

| Test Suite                      | Purpose                                      | Documentation                       |
| ------------------------------- | -------------------------------------------- | ----------------------------------- |
| **[bugs](./bugs/)**             | Bug documentation and reproduction tests     | [README.md](./bugs/README.md)       |
| **[regression](./regression/)** | Historical bug reproduction and verification | [README.md](./regression/README.md) |

Bug categories include: member addition issues, KPKE errors, panic scenarios, welcome message problems, stitching bugs, and other miscellaneous issues.

## 🔧 Other Test Suites

Additional specialized testing suites for specific use cases and edge scenarios.

| Test Suite            | Purpose                                  | Documentation            |
| --------------------- | ---------------------------------------- | ------------------------ |
| **[other](./other/)** | Miscellaneous and specialized test cases | [View tests →](./other/) |

Includes: Push notification testing, rate limiting validation, and large group performance tests.

## 🏃‍♂️ Running Test Suites

Each test suite can be run independently using the following patterns:

```bash
# Run specific test suites
yarn test functional          # Core functionality tests
yarn test groups             # Group stress testing
yarn test mobile             # Mobile performance tests
yarn test storage            # Storage efficiency analysis
yarn test metrics/delivery   # Delivery reliability tests
yarn test metrics/performance # Performance metrics

# Run individual test files
yarn test suites/functional/streams.test.ts
yarn test suites/large/membership.test.ts
yarn test suites/mobile/mobile.test.ts
```

## 📊 Test Coverage

Our test suites provide comprehensive coverage across:

- **Protocol Features**: DMs, groups, installations, metadata, streams, sync
- **Performance**: Message delivery, storage efficiency, mobile responsiveness
- **Scalability**: Large groups, high message volumes, concurrent operations
- **Security**: Spam prevention, consent management, permission controls
- **Reliability**: Offline capabilities, message ordering, error handling
- **Regression**: Historical bug prevention and validation
