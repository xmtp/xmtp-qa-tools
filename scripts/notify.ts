#!/usr/bin/env tsx
import {
  extractErrorLogs,
  extractfail_lines,
  sendSlackNotification,
  shouldFilterOutTest,
} from "../helpers/analyzer";

async function main() {
  const [testName, environment, workflow, status] = process.argv.slice(2);

  if (!testName) {
    console.error(
      "Usage: tsx scripts/notify.ts <testName> [environment] [workflow] [status]",
    );
    process.exit(1);
  }

  console.log(`Sending notification for test: ${testName}`);

  // Extract error logs from the test
  const errorLogs = extractErrorLogs(testName);
  const fail_lines = extractfail_lines(errorLogs);

  // Check if we should filter out this test
  if (shouldFilterOutTest(errorLogs, fail_lines)) {
    console.log("Test filtered out, no notification sent");
    return;
  }

  // Send the notification
  await sendSlackNotification(errorLogs, testName);
}

main().catch(console.error);
