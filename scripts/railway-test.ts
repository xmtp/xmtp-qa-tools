import { execSync } from "child_process";
import { sendTestResults } from "@helpers/datadog";

type TestResult = "success" | "failure";

async function runTests(): Promise<void> {
  let status: TestResult = "failure";
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
  console.log("Starting performance tests...");

  // Run the tests with retry logic
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`Attempt ${i}...` + testName);
      execSync(`yarn test ${testName}`, { stdio: "inherit" });
      // If we get here, tests passed
      status = "success";
      break;
    } catch (e) {
      console.log(e);
      if (i === 3) {
        console.log("Test failed after 3 attempts.");
        status = "failure";
      } else {
        console.log("Retrying in 10 seconds...");
        // Wait 10 seconds before retrying
        execSync("sleep 10");
      }
    }
  }

  // Report results to Datadog
  sendTestResults(status, testName);
}

// Run tests when this script is executed
void runTests();
