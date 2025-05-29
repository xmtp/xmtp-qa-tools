# XMTP Regression Testing Suite

This manual test suite focuses on reproducing and verifying fixes for historical bugs and issues in the XMTP protocol and clients.

## 🎯 Purpose

- Reproduce historical bugs to ensure they remain fixed
- Verify regression fixes across different client versions
- Validate edge cases that have caused issues in the past
- Ensure stability across XMTP protocol updates

## 🚀 Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```bash
LOGGING_LEVEL=info  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev

# Regression test configuration
REGRESSION_TARGET_VERSION=""  # Specific version to test against
HISTORICAL_DATA_PATH=""       # Path to historical test data

# Test worker configuration
# Additional workers will be auto-populated during testing
```

## 🏃‍♂️ Test Execution

```bash
yarn test regression
```

## 📋 Test Categories

### 1. Message Delivery Issues

- Historical message loss scenarios
- Duplicate message delivery bugs
- Message ordering inconsistencies
- Cross-client delivery failures

### 2. Group Conversation Bugs

- Group membership synchronization issues
- Admin permission edge cases
- Group metadata corruption
- Member addition/removal failures

### 3. Client State Issues

- Database corruption scenarios
- Sync state inconsistencies
- Key rotation problems
- Installation ID conflicts

### 4. Performance Regressions

- Memory leak scenarios
- CPU usage spikes
- Network request optimization
- Database query performance

## 🐛 Known Historical Issues

### Issue #1: Group Fork Bug

- **Description**: Group conversations would fork under specific membership change patterns
- **Reproduction**: Rapid add/remove cycles with timing constraints
- **Status**: ✅ Fixed in v2.0.1
- **Test**: Automated verification in group membership tests

### Issue #2: Message Duplication

- **Description**: Messages appearing multiple times in conversation
- **Reproduction**: Network interruption during message send
- **Status**: ✅ Fixed in v1.8.5
- **Test**: Network interruption simulation

### Issue #3: Sync State Corruption

- **Description**: Client sync state becoming corrupted after offline period
- **Reproduction**: Extended offline period followed by rapid sync
- **Status**: ✅ Fixed in v2.0.0
- **Test**: Offline/online cycle testing

## 📊 Test Scenarios

### Message Reliability Tests

```typescript
// Example regression test pattern
it("should not duplicate messages on network interruption", async () => {
  // Send message
  // Simulate network interruption
  // Verify single message delivery
});
```

### Group Consistency Tests

```typescript
// Example group regression test
it("should maintain group consistency during rapid membership changes", async () => {
  // Create group
  // Perform rapid add/remove cycles
  // Verify all clients have consistent member list
});
```

### Client State Tests

```typescript
// Example state regression test
it("should recover properly from corrupted sync state", async () => {
  // Corrupt client state
  // Trigger recovery mechanism
  // Verify full functionality restoration
});
```

## ⚠️ Manual Verification Steps

1. **Environment Setup**:

   - Configure multiple client versions if testing version compatibility
   - Set up network simulation tools for connection testing
   - Prepare historical data sets if needed

2. **Test Execution**:

   - Run tests in isolated environments
   - Monitor system resources during execution
   - Capture detailed logs for analysis

3. **Results Validation**:
   - Compare results with expected behavior
   - Verify no side effects or new regressions
   - Document any new issues discovered

## 🔧 Troubleshooting

### Test Environment Issues

- Ensure proper client version configuration
- Verify network simulation tools are working
- Check historical data integrity

### Reproduction Failures

- Review exact reproduction steps from original bug reports
- Verify environment matches original issue conditions
- Check for client version differences

### New Issues Discovery

- Document new issues with detailed reproduction steps
- Create minimal reproduction cases
- Report to development team with full context

## 📈 Regression Test Matrix

| Issue Category   | Test Type      | Frequency | Priority |
| ---------------- | -------------- | --------- | -------- |
| Message Delivery | Automated      | Daily     | High     |
| Group Operations | Semi-automated | Weekly    | High     |
| Client State     | Manual         | Monthly   | Medium   |
| Performance      | Automated      | Daily     | Medium   |

## 🤝 Contributing

When adding new regression tests:

1. **Document the original issue** with clear reproduction steps
2. **Create focused test cases** that isolate the specific problem
3. **Include both positive and negative test cases**
4. **Add proper test metadata** (version affected, fix version, etc.)
5. **Update the regression matrix** with new test information

## 📋 Regression Checklist

Before marking a regression test as complete:

- [ ] Original issue can be reproduced in affected version
- [ ] Fix is verified in current version
- [ ] Test covers edge cases mentioned in original report
- [ ] No new regressions introduced by the fix
- [ ] Test is documented and added to automated suite where possible
