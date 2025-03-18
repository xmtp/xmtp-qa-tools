import { execSync } from "child_process";
import { sendTestResults } from "@datadog/helper";

function runTests(): void {
  let hasFailures: boolean = false;
  // Get the test name from command line arguments or use default
  const testName = process.argv[2] || "TS_Performance";

  // Validate environment variables
  if (!process.env.DATADOG_API_KEY) {
    console.warn(
      "DATADOG_API_KEY is not set. Metrics will not be reported to Datadog.",
    );
  }

  if (!process.env.XMTP_ENV) {
    console.warn("XMTP_ENV is not set. Using default environment.");
  }
  console.log("XMTP_ENV", process.env.XMTP_ENV);
  console.log("Starting performance tests...");

  // Run the tests with retry logic
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`Attempt ${i}...` + testName);
      execSync(`yarn test ${testName}`, { stdio: "inherit" });
      break;
    } catch (e) {
      console.log(e);
      if (i === 3) {
        console.log("Test failed after 3 attempts.");
        hasFailures = true;
      } else {
        console.log("Retrying in 10 seconds...");
        // Wait 10 seconds before retrying
        execSync("sleep 10");
      }
    }
  }

  // Report results to Datadog
  sendTestResults(hasFailures, testName);
}

// Run tests when this script is executed
runTests();
