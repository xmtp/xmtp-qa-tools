# XMTP QA Tools - Known Issues Documentation

This document provides a comprehensive overview of all known issues, bugs, and limitations in the XMTP QA Tools testing framework.

## 📋 Overview

The XMTP QA Tools framework has several categories of known issues that are being tracked and managed:

1. **Documented Bugs** - Specific technical issues with solutions
2. **Known Test Failures** - Flaky tests that are filtered from notifications
3. **Network and Performance Issues** - Infrastructure-related problems
4. **Bot and Agent Issues** - Problems with automated testing agents
5. **Environment and Configuration Issues** - Setup and deployment problems

---

## 🐛 Documented Bugs

### 1. **Stitch Issues** (`bug_stitch/`)
- **Category**: Setup and Installation Problems
- **Description**: Problems during client setup and installation process
- **Location**: `suites/bugs/bug_stitch/`
- **Impact**: Affects initial client bootstrapping

### 2. **Panic Errors** (`bug_panic/`)
- **Category**: Runtime Crashes
- **Description**: Tokio runtime worker panics causing complete test failures
- **Error Pattern**: `async fn resumed after completion`
- **Location**: `suites/bugs/bug_panic/`
- **Sample Error**:
  ```
  thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_messages.rs:211:73:
  `async fn` resumed after completion
  ```

### 3. **Large Group Sync Issues** (`bug_largegroup/`)
- **Category**: Scalability Problems
- **Description**: Issues with synchronizing large groups (50+ members)
- **Location**: `suites/bugs/bug_largegroup/`
- **Impact**: Affects large-scale testing scenarios

### 4. **Welcome Message Issues** (`bug_welcome/`)
- **Category**: Group Onboarding
- **Description**: Problems with welcome message handling and group member onboarding
- **Location**: `suites/bugs/bug_welcome/`
- **Common Error**: `Error, decoded message length too large: found X bytes, the limit is: 4194304 bytes`

### 5. **Add Member Issues** (`bug_addmember/`)
- **Category**: Group Management
- **Description**: Problems when adding new members to existing groups
- **Location**: `suites/bugs/bug_addmember/`

### 6. **Key Package Issues** (`bug_kpke/`)
- **Category**: Cryptographic Key Management
- **Description**: Problems with key package exchange and management
- **Location**: `suites/bugs/bug_kpke/`

---

## 🔄 Known Test Failures

The following tests are known to fail intermittently and are filtered from Slack notifications:

### Browser Tests
- **Test**: `suites/browser/browser.test.ts > browser > conversation stream for new member`
- **Issue**: Browser automation flakiness
- **Status**: Known issue - notifications suppressed

### Functional Tests
- **Test**: `suites/functional/callbacks.test.ts > callbacks > should receive conversation with async`
- **Issue**: Async callback timing issues
- **Status**: Known issue - notifications suppressed

- **Test**: `suites/functional/playwright.test.ts > playwright > newGroup and message stream`
- **Issue**: Playwright automation instability
- **Status**: Known issue - notifications suppressed

### Agent Tests
- **Test**: `suites/agents/agents-tagged.test.ts > agents-tagged > production: tokenbot should respond to tagged/command message`
- **Issue**: External bot reliability problems
- **Affected Addresses**: 
  - `0x9E73e4126bb22f79f89b6281352d01dd3d203466`
  - `0xdfc00a0B28Df3c07b0942300E896C97d62014499`
- **Status**: Known issue - notifications suppressed

- **Test**: `suites/agents/agents-dms.test.ts > agents-dms > production: tokenbot DM`
- **Issue**: Direct message bot functionality
- **Affected Address**: `0x9E73e4126bb22f79f89b6281352d01dd3d203466`
- **Status**: Known issue - notifications suppressed

---

## 🌐 Network and Performance Issues

### 1. **Message Size Limits**
- **Issue**: `decoded message length too large`
- **Limit**: 4,194,304 bytes (4MB)
- **Impact**: Affects welcome message processing and large group operations
- **Common Pattern**: `Error, decoded message length too large: found X bytes, the limit is: 4194304 bytes`

### 2. **Database Locking**
- **Issue**: SQLite database connection locks
- **Error Pattern**: `connection database is locked`
- **Impact**: Concurrent operation failures
- **Location**: Welcome message processing

### 3. **Network Partition Tolerance**
- **Issue**: Tests for network fault tolerance
- **Test Suite**: `suites/networkchaos/`
- **Challenges**: 
  - Latency injection
  - Packet loss simulation
  - Network partitioning
  - Connection recovery

### 4. **Epoch Increment Errors**
- **Issue**: `epoch increment not allowed`
- **Impact**: Group message processing failures
- **Context**: MLS protocol epoch management

---

## 🤖 Bot and Agent Issues

### 1. **External Bot Dependencies**
- **Issue**: Third-party bots may be unreliable
- **Affected Bots**: tokenbot, byte, csx, gang, flaunchy, mamo, squabble
- **Impact**: Agent monitoring tests fail intermittently
- **Mitigation**: Known issue filtering in place

### 2. **Response Time Variability**
- **Issue**: Bot response times vary significantly
- **Impact**: Timing-sensitive tests may fail
- **Test Pattern**: Tagged message responses

### 3. **Bot Availability**
- **Issue**: External bots may be offline
- **Networks**: Both dev and production
- **Monitoring**: Slack alerts configured per bot

---

## 🔧 Environment and Configuration Issues

### 1. **Version Compatibility**
- **Issue**: Different SDK versions may have incompatible behaviors
- **Test Coverage**: `suites/functional/regression.test.ts`
- **SDK Versions**: 0.0.47 (Legacy), 1.0.5-3.0.1 (Current)

### 2. **Environment Setup**
- **Issue**: Missing dependencies or configuration
- **Common Problems**:
  - Missing `XMTP_ENV` environment variable
  - Incorrect network configuration
  - Missing API keys for external services

### 3. **Resource Limits**
- **Issue**: Memory and CPU constraints in CI/CD
- **Impact**: Large-scale tests may fail
- **Test Categories**: Performance, large group tests

---

## 📊 Log Noise and Deduplication

The following patterns are deduplicated in logs to reduce noise:

- `sqlcipher_mlock` - SQLite memory locking warnings
- `Collector timed out` - Timeout issues
- `welcome with cursor` - Welcome message processing
- `group with welcome id` - Group welcome handling
- `receiveGroupMessage` - Group message reception
- `receiveNewConversation` - New conversation handling
- `Skipping welcome` - Welcome message skipping
- `Skipping already processed` - Duplicate processing prevention
- `xmtp_mls::groups::key_package_cleaner_worker` - Key package cleanup
- `xmtp_mls::groups::mls_sync` - MLS synchronization
- `xmtp_mls::groups::welcome_sync` - Welcome synchronization

---

## 🛠️ Monitoring and Alerting

### Slack Notifications
- **Filtered Issues**: Known test failures are suppressed
- **Active Alerts**: Only genuine failures trigger notifications
- **Channels**: Bot-specific channels for agent monitoring

### Datadog Integration
- **Log Analysis**: Automated log analysis with AI
- **Pattern Recognition**: Identifies recurring issues
- **Metrics**: Performance and reliability metrics

### GitHub Actions
- **CI/CD Filtering**: Failed jobs on known issues don't block deployments
- **Branch Protection**: Only main branch failures trigger alerts
- **Success Override**: `--no-fail` flag for monitoring jobs

---

## 🔄 How to Report New Issues

1. **Determine if it's a new issue** vs. known problem
2. **Add to appropriate category**:
   - `suites/bugs/` for technical bugs
   - `helpers/known_issues.json` for test failures
   - `helpers/analyzer.ts` for log noise
3. **Document the issue** with:
   - Error patterns
   - Reproduction steps
   - Impact assessment
   - Workarounds if available
4. **Test the filtering** to ensure notifications work correctly

---

## 📈 Issue Status and Tracking

- **Active Issues**: Bugs currently affecting tests
- **Mitigated Issues**: Known problems with workarounds
- **Suppressed Issues**: Notifications disabled for known flaky tests
- **Monitored Issues**: Issues tracked but not blocking CI/CD

---

## 🔗 Related Documentation

- [Bug Template](suites/bugs/BUG_TEMPLATE.md) - Template for reporting new bugs
- [Known Issues Configuration](.cursor/rules/known-issues.md) - How to add new known issues
- [Monitoring Setup](helpers/analyzer.ts) - Error analysis and filtering
- [Agent Configuration](suites/agents/agents.json) - Bot monitoring setup

---

*Last Updated: January 2025*
*For questions or updates, refer to the XMTP QA Tools repository.*