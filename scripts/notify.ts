#!/usr/bin/env tsx
import { sendSlackNotification } from "../helpers/analyzer";

async function main() {
  const [testName, environment, workflow, status] = process.argv.slice(2);

  if (!testName || !environment || !workflow || !status) {
    console.error(
      "Usage: tsx scripts/notify.ts <testName> <environment> <workflow> <status>",
    );
    process.exit(1);
  }

  console.log(`Sending notification for test: ${testName}`);

  await sendSlackNotification(testName, environment, workflow, status);
}

main().catch(console.error);
