# GitHub Actions Timeout Notification Issue Analysis

## Problem Summary

When GitHub Actions workflows timeout (e.g., the Performance workflow with `timeout-minutes: 10`), you don't receive Slack notifications. This happens because:

1. **Timeouts result in immediate process termination** - GitHub Actions sends SIGKILL (not SIGTERM) to processes when they timeout
2. **No graceful shutdown opportunity** - The CLI notification system never gets a chance to send Slack notifications
3. **Missing failure detection** - The current notification system only triggers when tests complete with explicit `--debug` flags

## Root Cause Analysis

### GitHub Actions Timeout Behavior

Based on GitHub's documentation and community discussions:

- **Job-level timeout**: When `timeout-minutes: 10` is exceeded, GitHub Actions immediately kills the entire job
- **Process termination**: Uses SIGKILL (not SIGTERM), providing no opportunity for graceful shutdown
- **No cleanup phase**: Unlike test failures, timeouts don't allow the CLI to execute notification logic in `scripts/cli.ts`

### Current Notification System

In `scripts/cli.ts` (lines 388-392), notifications are only sent when:
```typescript
// Only send Slack notification when debug flags are explicitly used
if (options.explicitLogFlag) {
  const errorLogs = extractErrorLogs(logger.logFileName, 20);
  if (errorLogs.size > 0) {
    await sendSlackNotification({
      testName,
      errorLogs,
    });
  }
}
```

This code never executes during a timeout because the process is killed before reaching this point.

### Current Workflow Configuration

Performance.yml (and other workflows) structure:
```yaml
- name: Run tests
  run: yarn test ${{ matrix.test }} --no-fail --debug
- name: Upload test artifacts
  if: always()  # This runs even on timeout
  uses: actions/upload-artifact@v4
```

The `if: always()` step runs even on timeout, but it only uploads artifacts - it doesn't send notifications.

## Solutions

### Solution 1: Add Timeout-Specific Notification Step (Recommended)

Add a dedicated step that runs on timeout to send notifications:

```yaml
- name: Run tests
  id: run-tests  # Add ID to reference this step
  run: yarn test ${{ matrix.test }} --no-fail --debug

- name: Send timeout notification
  if: failure() && steps.run-tests.conclusion == 'failure'
  run: |
    # Create a simple timeout notification script
    node -e "
    const { sendSlackNotification } = require('./helpers/notifications');
    sendSlackNotification({
      testName: '${{ matrix.test }}',
      label: 'error',
      errorLogs: new Set(['Workflow timed out after ${{ job.timeout-minutes || 10 }} minutes']),
      env: '${{ matrix.environment }}',
      jobStatus: 'timeout'
    }).catch(console.error);
    "

- name: Upload test artifacts
  if: always()
  uses: actions/upload-artifact@v4
  # ... existing artifact configuration
```

### Solution 2: Wrapper Script with Signal Handling

Create a wrapper script that can handle timeouts gracefully:

1. **Create `scripts/timeout-wrapper.js`**:
```javascript
const { spawn } = require('child_process');
const { sendSlackNotification } = require('../helpers/notifications');

const timeout = (parseInt(process.env.TIMEOUT_MINUTES) || 10) * 60 * 1000 - 30000; // 30s buffer
const command = process.argv.slice(2).join(' ');

const child = spawn('bash', ['-c', command], { 
  stdio: 'inherit',
  env: process.env 
});

const timeoutHandle = setTimeout(async () => {
  console.log('⚠️ Approaching timeout limit, sending notification...');
  
  await sendSlackNotification({
    testName: process.env.TEST_NAME || 'unknown',
    label: 'error',
    errorLogs: new Set([
      `Test approaching ${timeout/60000}min timeout limit`,
      'GitHub Actions will terminate this job soon'
    ]),
    env: process.env.XMTP_ENV
  });
  
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 5000);
}, timeout);

child.on('exit', (code) => {
  clearTimeout(timeoutHandle);
  process.exit(code);
});
```

2. **Update workflow to use wrapper**:
```yaml
- name: Run tests
  run: node scripts/timeout-wrapper.js yarn test ${{ matrix.test }} --no-fail --debug
  env:
    TIMEOUT_MINUTES: ${{ job.timeout-minutes || 10 }}
    TEST_NAME: ${{ matrix.test }}
```

### Solution 3: Enhanced Notification System (Most Comprehensive)

Modify the notification system to handle different failure types:

1. **Update `helpers/notifications.ts`** to add timeout detection:
```typescript
export interface TimeoutNotificationOptions {
  testName: string;
  timeoutMinutes: number;
  env?: string;
  channel?: string;
}

export async function sendTimeoutNotification(
  options: TimeoutNotificationOptions,
): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log("Timeout notification skipped (SLACK_BOT_TOKEN not set)");
    return;
  }

  const message = generateTimeoutMessage(options);
  await postToSlack(message, options.channel);
}

function generateTimeoutMessage(options: TimeoutNotificationOptions): string {
  const { testName, timeoutMinutes, env } = options;
  const url = generateUrl();
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return [
    `*Workflow Timeout ⏰*`,
    `*Test:* ${testName}`,
    `*Environment:* \`${env}\``,
    `*Timeout:* ${timeoutMinutes} minutes`,
    `*Timestamp:* \`${timestamp}\``,
    url ? `*Test log:* <${url}|View url>` : "",
    `\`\`\`Workflow exceeded ${timeoutMinutes} minute timeout limit\`\`\``
  ].filter(Boolean).join("\n");
}
```

2. **Add workflow step**:
```yaml
- name: Run tests
  id: run-tests
  run: yarn test ${{ matrix.test }} --no-fail --debug
  continue-on-error: true

- name: Handle timeout/failure
  if: always() && steps.run-tests.outcome != 'success'
  run: |
    if [ "${{ steps.run-tests.outcome }}" = "failure" ]; then
      # Check if it was a timeout (GitHub Actions sets this when timeout occurs)
      if [ "${{ job.status }}" = "failure" ] && [ -z "$(find logs/ -name '*.log' -newer $(date -d '10 minutes ago' '+%Y-%m-%d %H:%M:%S') 2>/dev/null)" ]; then
        echo "Detected timeout condition"
        node -e "
        const { sendTimeoutNotification } = require('./helpers/notifications');
        sendTimeoutNotification({
          testName: '${{ matrix.test }}',
          timeoutMinutes: 10,
          env: '${{ matrix.environment }}'
        }).catch(console.error);
        "
      else
        echo "Regular test failure - notification should have been sent by CLI"
      fi
    fi
```

## Recommended Implementation

**Solution 1** is recommended because it's:
- **Simple to implement** - requires minimal code changes
- **Reliable** - uses GitHub's built-in `if: failure()` condition
- **Maintainable** - doesn't require complex wrapper scripts
- **Consistent** - uses the existing notification infrastructure

## Implementation Steps

1. **Test the fix** on a single workflow (e.g., Performance.yml)
2. **Verify notifications** are sent on both timeout and regular failures
3. **Roll out** to all workflows once verified
4. **Update documentation** to reflect the new notification behavior

## Additional Considerations

- **Timeout buffer**: Consider reducing job timeout by 1-2 minutes to allow notification step to run
- **Notification deduplication**: Ensure we don't send duplicate notifications for the same failure
- **Log preservation**: The existing artifact upload step should still preserve logs for debugging