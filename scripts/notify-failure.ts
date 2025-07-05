#!/usr/bin/env tsx
import { extractErrorLogs, sendSlackNotification } from "../helpers/analyzer";
import "dotenv/config";

async function notifyWorkflowFailure() {
  const testName = process.argv[2];
  const environment = process.argv[3];
  const workflowName = process.argv[4];
  const status = process.argv[5] || "failed";

  if (!testName || !environment || !workflowName) {
    console.error(
      "Usage: tsx notify-failure.ts <testName> <environment> <workflowName> [status]",
    );
    process.exit(1);
  }

  console.log(
    `Sending failure notification for ${workflowName} - ${testName} (${environment})`,
  );

  // Extract error logs from the test
  const errorLogs = extractErrorLogs(testName);

  // Create a synthetic error log if no logs are found
  if (errorLogs.size === 0) {
    const syntheticError = `Workflow ${workflowName} ${status} - Test: ${testName}, Environment: ${environment}`;
    errorLogs.add(syntheticError);
  }

  // Create fail_lines for the notification
  const fail_lines = [`FAIL  suites/${testName}/${testName}.test.ts`];

  try {
    await sendSlackNotification(errorLogs, testName, fail_lines);
    console.log("✅ Slack notification sent successfully");
  } catch (error) {
    console.error("❌ Failed to send Slack notification:", error);
    process.exit(1);
  }
}

void notifyWorkflowFailure();
