# Datadog Integration Test Suite

This test suite provides functionality for accessing and analyzing Datadog logs for test failures and system monitoring. It replaces the previous Slack bot functionality with a proper test suite structure.

## Purpose

- **Fetch Latest Logs**: Retrieves the most recent logs from Datadog for analysis
- **Process Test Failures**: Identifies and processes test failure logs from Datadog
- **AI Analysis**: Uses Claude AI to analyze test failures and provide insights
- **Data Storage**: Stores processed logs in `issues.json` for further analysis

## Environment Variables

Required environment variables for full functionality:

```bash
# Datadog API access
DATADOG_API_KEY=your_datadog_api_key
DATADOG_APP_KEY=your_datadog_app_key

# Claude AI analysis (optional - runs in mock mode without it)
ANTHROPIC_API_KEY=your_anthropic_api_key

#  environment
XMTP_ENV=dev  # or production, local
```

## Usage

### Run the Complete Datadog Test Suite

```bash
# Run all Datadog tests
yarn test suites/datadog

# Run with specific environment
XMTP_ENV=production yarn test suites/datadog
```

### Individual Test Operations

```bash
# Just fetch latest logs
yarn test suites/datadog/datadog.test.ts -t "should fetch latest Datadog logs"

# Test Claude analysis
yarn test suites/datadog/datadog.test.ts -t "should analyze issues with Claude"

# Test data refresh
yarn test suites/datadog/datadog.test.ts -t "should refresh issues data periodically"
```

## Test Functions

### 1. Fetch Latest Datadog Logs

- Connects to Datadog API
- Retrieves logs from the last 4 hours by default
- Filters for test failure logs
- Returns metadata about log counts and time ranges

### 2. Read Processed Issues Data

- Reads the locally stored `issues.json` file
- Validates the data structure
- Reports on the number of processed issues

### 3. Analyze Issues with Claude

- Uses Claude AI to analyze test failure patterns
- Provides insights on critical failures
- Returns formatted analysis suitable for reporting

### 4. Refresh Issues Data Periodically

- Forces a fresh fetch from Datadog
- Measures performance of the refresh operation
- Validates that data is properly stored locally

## Output Files

- `suites/datadog/issues.json` - Processed test failure data from Datadog

## API Integration

### Datadog API

- Uses Datadog Logs API v2
- Searches for service: `xmtp-qa-tools`
- Filters for error-level logs with test context
- Supports pagination for large result sets

### Claude AI Integration

- Uses Claude Sonnet 4 for log analysis
- Configured with specialized prompts for test failure analysis
- Formats responses for easy consumption
- Falls back to mock mode if API key is not available

## Migration from Slack Bot

This test suite replaces the previous Slack bot functionality:

- **Before**: Slack bot with auto-refresh and interactive responses
- **After**: Test suite that can be run on-demand or scheduled
- **Benefits**:
  - Integrates with existing test infrastructure
  - Can be run in CI/CD pipelines
  - Provides structured test results
  - Easier to monitor and debug

## Example Output

```
📊 Fetched 1,247 total log entries
🚨 Found 23 test failures
⏰ Query period: 2024-01-15T10:00:00.000Z to 2024-01-15T14:00:00.000Z
📄 Found 23 processed issue entries
Claude analysis length: 847 characters
📝 Analysis preview: *Critical Test Failures Analysis*

The most significant issues in the last 4 hours involve...
Data refresh completed in 3,421ms
```
