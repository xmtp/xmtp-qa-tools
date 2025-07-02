# XMTP QA Tools - Historical Data Access

This directory provides access to historical test data, performance metrics, and analysis previously managed by the Slack bot. All data is now accessible to Cursor agents through structured files and utilities.

## Data Sources

### 1. Test Failure History (`issues.json`)

Structured test failure data from Datadog logs:

- **Performance tests**: Message delivery, response times, group operations
- **Browser tests**: Cross-browser compatibility failures
- **Agent tests**: Live production bot monitoring
- **Functional tests**: Core protocol functionality
- **Large group tests**: Scalability testing (50-400 members)

### 2. Performance Metrics (`dashboard.json`)

Datadog dashboard configuration with metrics for:

- **Delivery Rate**: Message delivery success percentage
- **Order Rate**: Message ordering accuracy
- **Response Times**: Agent and operation performance
- **Network Performance**: DNS, TLS, server processing times
- **SDK Operations**: Core functionality benchmarks

### 3. Log Analysis Patterns (`analyzer.ts`)

Known issue patterns and deduplication rules:

- **Known Issues**: Cataloged test failures and their signatures
- **Error Patterns**: Regex patterns for log analysis
- **Deduplication**: Rules to filter repeated/known errors

## Data Structure

### Test Failure Format

```json
{
  "id": "unique-log-id",
  "type": "log",
  "environment": "production|dev",
  "test": "performance|browser|agents|functional|large",
  "level": "error",
  "service": "xmtp-qa-tools",
  "region": "us-east",
  "env": "production|dev",
  "libxmtp": "latest|version",
  "message": [
    "Detailed error message line 1",
    "FAIL suites/path/test.ts > test description"
  ]
}
```

### Performance Metrics

- **Delivery Rate**: 95-100% (target: >99%)
- **Order Rate**: 90-100% (target: >99%)
- **Response Times**: Agent responses in milliseconds (target: <1000ms)
- **Network Latency**: DNS/TLS/server times (target: <300ms)

## Usage for Cursor Agents

### 1. Recent Test Issues

```bash
# View latest test failures
cat history/issues.json | jq '.[] | select(.test=="performance") | .message'

# Check specific environment issues
cat history/issues.json | jq '.[] | select(.environment=="production")'
```

### 2. Performance Analysis

```bash
# Extract performance metrics trends
node history/analyze-performance.js

# Generate performance summary report
node history/generate-summary.js --type=performance --days=7
```

### 3. Known Issues Reference

```bash
# Check if current failure is a known issue
node history/check-known-issues.js --error="test failure pattern"

# List all known issue patterns
cat helpers/analyzer.ts | grep -A 10 "KNOWN_ISSUES"
```

## Key Data Insights

### Current Issue Patterns (from latest data)

1. **Browser Tests**: `conversation stream for new member` failures
2. **Performance Tests**: Message collector timeouts (10s limit)
3. **Agent Tests**: Response timeouts for production bots (20s limit)
4. **Functional Tests**: Async conversation callback issues

### Critical Metrics to Monitor

- **Agent Response Times**: Several agents showing >20s timeouts
- **Message Delivery**: Performance test collectors timing out
- **Group Operations**: Welcome message processing errors
- **Network Stability**: Key package cleaner worker errors

### Environment Differences

- **Production**: More welcome processing errors, memory constraints
- **Dev**: Similar patterns but lower frequency
- **Geographic**: Issues concentrated in us-east region

## Automated Data Collection

The system automatically:

1. **Fetches Datadog logs** every 10 minutes via GitHub Actions
2. **Processes and deduplicates** error patterns
3. **Updates issues.json** with new failure data
4. **Maintains historical trends** for analysis

## Migration from Slack Bot

This replaces the previous Slack bot functionality:

- ✅ **Data Processing**: Moved to `history/` utilities
- ✅ **Pattern Analysis**: Available via `analyzer.ts`
- ✅ **Historical Access**: Structured JSON and markdown files
- ✅ **Automated Collection**: Maintained via GitHub Actions
- ❌ **Slack Notifications**: Removed (use Cursor agents instead)
- ❌ **Interactive Queries**: Replaced with file-based access

## Quick Commands

```bash
# Get performance summary for last 24 hours
yarn history:performance

# Check for new error patterns
yarn history:analyze

# Generate weekly test report
yarn history:report --week

# Clean and process raw logs
yarn history:clean-logs
```
