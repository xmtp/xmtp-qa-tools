---
description: How to add known issue patterns to reduce notification noise
globs: 
alwaysApply: false
---

# Adding Known Issue Patterns

When users report recurring test failures or log noise that should be tracked as known issues, update the monitoring system to prevent false alerts.

## Files to Update

### 1. `helpers/known_issues.json` - Specific Test Failures

Add entries for specific test failures that are known issues:

```json
{
  "testName": "test-suite-name",
  "uniqueErrorLines": [
    "FAIL  suites/path/test.ts > test-name > specific failure pattern"
  ]
}
```

**Guidelines:**
- Use the actual test suite name (e.g., "agents-tagged", "Functional", "Browser")
- Copy the exact FAIL line from logs, including the full path and specific error
- Multiple related failures can be grouped under the same testName
- For bot failures, group by the test suite, not individual bots

**Example:**
```json
{
  "testName": "Agents-tagged",
  "uniqueErrorLines": [
    "FAIL  suites/agents/agents-tagged.test.ts > agents-tagged > production: tokenbot should respond to tagged/command message : 0x9E73e4126bb22f79f89b6281352d01dd3d203466",
    "FAIL  suites/agents/agents-tagged.test.ts > agents-tagged > production: byte should respond to tagged/command message : 0xdfc00a0B28Df3c07b0942300E896C97d62014499"
  ]
}
```

### 2. `helpers/analyzer.ts` - DEDUPE Patterns (Only if needed)

Add to the DEDUPE array for recurring log noise that appears frequently:

```typescript
DEDUPE: [
  // ... existing patterns
  "new recurring error pattern",
]
```

**Guidelines:**
- Only add if the pattern appears very frequently and clutters logs
- Use partial strings that uniquely identify the error type
- Don't add specific test failures here - those go in known_issues.json
- Focus on infrastructure/system errors, not test-specific failures

## When to Add Known Issues

- **Recurring bot failures** - Known unreliable bots or external dependencies
- **Infrastructure issues** - Network timeouts, storage errors, etc.
- **Flaky tests** - Tests that fail intermittently due to timing or environment
- **External service failures** - Third-party APIs or services that are down

## When NOT to Add

- **New genuine failures** - Real bugs that need investigation
- **Regression indicators** - Failures that suggest code issues
- **Performance degradation** - Slow tests that indicate problems

## Effect of Adding Known Issues

- **known_issues.json**: Prevents Slack notifications for matching test failures
- **DEDUPE patterns**: Reduces log noise in error analysis and reporting

## Process

1. Identify the recurring pattern from Slack alerts or logs
2. Determine if it's a genuine known issue vs. new problem
3. Add to appropriate file (usually just known_issues.json)
4. Test that the pattern matches by running affected tests
5. Verify notifications are suppressed for the known issue