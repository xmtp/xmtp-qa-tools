#!/usr/bin/env tsx

/**
 * Slack Integration Test Runner
 *
 * This script runs the Slack history fetching tests to verify
 * that the core functionality works correctly with mocked responses.
 */
import { execSync } from "child_process";
import path from "path";

const testFile = path.join(__dirname, "slack-history.test.ts");

console.log("🧪 Running Slack Integration Tests...");
console.log("====================================");

try {
  // Run the specific test file
  execSync(`npx vitest run ${testFile} --reporter=verbose`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  console.log("\n✅ All Slack integration tests passed!");
  console.log(
    "The core Slack history fetching functionality is working correctly.",
  );
} catch (error) {
  console.error("\n❌ Some tests failed!");
  console.error("Check the output above for details.");
  process.exit(1);
}
