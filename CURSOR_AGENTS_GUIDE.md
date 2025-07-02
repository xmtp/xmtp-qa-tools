# XMTP QA Tools - Cursor Agents Access Guide

## 🔄 Migration Complete: Slack Bot → Cursor Agent Access

The Slack bot has been **successfully removed** and replaced with a comprehensive data access system for Cursor agents. All historical test data, performance metrics, and analysis capabilities are now available through structured files and utilities.

## 📊 What Data is Available

### 1. **Real-time Test Failures** (`history/issues.json`)

- **33 current test failure entries** from Datadog logs
- **Structured data** with test type, environment, error details
- **Auto-updated** by GitHub Actions every 30 minutes to 6 hours

### 2. **Performance Metrics** (`dashboard.json`)

- **Delivery rates**: Message delivery success (target: >99%)
- **Order rates**: Message ordering accuracy (target: >99%)
- **Response times**: Agent performance (target: <1000ms)
- **Network metrics**: DNS, TLS, server timing (target: <300ms)

### 3. **Analysis Patterns** (`helpers/analyzer.ts`)

- **Known issue patterns** and signatures
- **Error deduplication** rules
- **Common failure categorization**

## 🚀 Quick Access Commands

```bash
# Get performance analysis
yarn history:performance

# Update data from Datadog
yarn history:analyze

# Generate daily report
yarn history:report --daily

# Generate trends analysis
yarn history:report --trends

# Clean raw logs
yarn history:clean-logs
```

## 📋 Current System Status

### **Critical Issues Identified**

- **Browser Tests**: 16 failures (🔴 High) - mainly "conversation stream for new member"
- **Agent Tests**: 11 failures (🔴 High) - response timeouts averaging 20s
- **Performance Tests**: 2 failures (🟢 Low) - collector timeouts at 10s
- **Environment Split**: Production showing 2x more issues than dev

### **Agent Performance Issues**

Multiple agents experiencing 20-second timeouts:

- `carl`, `mike`, `adam`, `mary`, `victor`, `ursula`, `bob`, `lisa`, `xavier`, `julia`

### **Common Error Patterns**

1. **"conversation stream for new member"** (18 occurrences)
2. **Agent "byte" production failures** (8 occurrences)
3. **Group/DM message stream issues** (13 combined occurrences)

## 🔍 How to Analyze Data

### **View Raw Historical Data**

```bash
# See all test failures
cat history/issues.json | jq '.'

# Filter by test type
cat history/issues.json | jq '.[] | select(.test=="performance")'

# Filter by environment
cat history/issues.json | jq '.[] | select(.environment=="production")'
```

### **Get Insights**

```bash
# Performance analysis with metrics
node history/analyze-performance.js

# Daily report with recommendations
node history/generate-report.js --daily

# Performance trends over time
node history/generate-report.js --trends
```

### **Check Known Issues**

```bash
# View known issue patterns
grep -A 10 "KNOWN_ISSUES" helpers/analyzer.ts

# Check if error is known
grep -r "conversation stream for new member" helpers/
```

## 📈 Data Collection & Updates

### **Automated Collection**

- **GitHub Actions** run tests every 15 minutes to 6 hours
- **Datadog integration** fetches latest failure logs
- **Auto-processing** deduplicates and structures data
- **Historical preservation** maintains 90-day artifact retention

### **Manual Updates**

```bash
# Force data update (requires DATADOG_API_KEY + DATADOG_APP_KEY)
yarn history:analyze --from="2025-01-01T00:00:00Z" --to="2025-01-02T00:00:00Z"

# Process local logs
yarn history:clean-logs
```

## 💡 Key Insights for Development

### **Current Focus Areas**

1. **Browser Compatibility**: High failure rate in cross-browser testing
2. **Agent Reliability**: Production agents timing out frequently
3. **Group Operations**: Welcome message processing issues
4. **Memory Management**: sqlcipher_mlock errors in production

### **Environment Differences**

- **Production**: More memory constraints, welcome processing errors
- **Dev**: Similar patterns but lower frequency
- **Geographic**: Issues concentrated in us-east region

### **Performance Trends**

- **Agent timeouts**: Consistent 20s timeouts suggest capacity issues
- **Performance timeouts**: 10s collector timeouts in group operations
- **Group errors**: Key package cleaner worker failures common

## 🛠️ Available Tools

### **Analysis Scripts**

- `history/analyze-performance.js` - Performance metrics analysis
- `history/datadog-processor.js` - Datadog log processing
- `history/generate-report.js` - Markdown report generation

### **Data Files**

- `history/issues.json` - Current test failures (updated automatically)
- `history/metadata.json` - Collection metadata and timestamps
- `history/daily-report.md` - Latest daily analysis
- `dashboard.json` - Datadog metrics configuration

### **Pattern Matching**

- `helpers/analyzer.ts` - Error pattern analysis and deduplication
- Known issue detection and filtering
- Common error pattern identification

## 🎯 Recommendations

### **Immediate Actions**

1. **Agent Timeouts**: Investigate 20s timeout pattern across multiple agents
2. **Browser Tests**: Address "conversation stream for new member" failures
3. **Memory Issues**: Monitor sqlcipher_mlock errors in production

### **Monitoring Focus**

1. **Delivery Rate**: Currently tracking, target >99%
2. **Response Times**: Agent performance, target <1000ms
3. **Order Rate**: Message sequencing, target >99%

### **Development Priorities**

1. **Group Operations**: Welcome message processing reliability
2. **Cross-platform**: Browser compatibility improvements
3. **Production Stability**: Memory and resource management

## 📞 Migration Summary

### ✅ **Preserved from Slack Bot**

- **Data Processing**: All Datadog log processing functionality
- **Pattern Analysis**: Known issues and error categorization
- **Historical Access**: Structured JSON and markdown output
- **Automated Collection**: GitHub Actions maintain data flow
- **Performance Metrics**: Full dashboard and analytics capability

### ❌ **Removed**

- **Slack Dependencies**: @slack/bolt package removed
- **Interactive Queries**: Replaced with file-based access
- **Slack Notifications**: No longer sent (Cursor agents handle monitoring)

### 🔄 **Enhanced**

- **Better Structure**: Organized in `history/` directory
- **CLI Tools**: Direct command-line access for analysis
- **Markdown Reports**: Human-readable summaries for agents
- **Automated Updates**: Integrated with existing CI/CD pipeline

---

**🎉 Migration Complete!** Cursor agents now have full access to XMTP QA historical data without Slack dependencies. Use the commands above to access real-time test insights, performance metrics, and failure analysis.
