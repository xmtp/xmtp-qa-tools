import { execSync } from "child_process";

function runTests(): void {
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
    }
  }
}

// Run tests when this script is executed
runTests();
