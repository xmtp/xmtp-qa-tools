import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import fetch from "node-fetch";
import { analyzeErrorLogsWithGPT } from "./ai";

// Check for required Slack credentials
if (!process.env.SLACK_BOT_TOKEN) {
  console.error("Error: SLACK_BOT_TOKEN environment variable is not set.");
  console.error(
    "Please add your Bot User OAuth Token to your .env file or environment variables:",
  );
  console.error("SLACK_BOT_TOKEN=xoxb-your-token");
  process.exit(1);
}

const slackChannel = process.env.SLACK_CHANNEL || "general";
console.debug(`Using Slack bot token with channel: ${slackChannel}`);

// Get GitHub Actions context if available
const datadogUrl =
  "https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&from_ts=1746630906777&to_ts=1746717306777&live=true";
const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
const runId = process.env.GITHUB_RUN_ID || "Unknown Run ID";
const githubRef = process.env.GITHUB_REF || "Unknown Branch";
const jobStatus = process.env.JOB_STATUS || "unknown";

// Find test name from suites directory
let testName = process.env.TEST_NAME;
if (!testName) {
  try {
    const suitesDir = path.join(process.cwd(), "suites");
    if (fs.existsSync(suitesDir)) {
      const testDirs = fs
        .readdirSync(suitesDir)
        .filter(
          (dir) =>
            dir.startsWith("TS_") &&
            fs.statSync(path.join(suitesDir, dir)).isDirectory(),
        );

      if (testDirs.length > 0) {
        testName = testDirs[0];
      }
    }
  } catch (error) {
    console.error("Error finding test name:", error);
  }
  testName = testName || "Unknown Test";
}

// Extract branch name from GITHUB_REF
const branchName = githubRef.replace("refs/heads/", "");
console.debug(`Current branch: ${branchName}`);

// Only proceed with notification if it's an error
if (jobStatus === "success" || jobStatus === "passed") {
  console.debug(`Job status is ${jobStatus}. No need to send notification.`);
  process.exit(0);
}

// Create workflow run URL if both repository and run ID are available
let workflowUrl = "";
if (repository !== "Unknown Repository" && runId !== "Unknown Run ID") {
  workflowUrl = `https://github.com/${repository}/actions/runs/${runId}`;
}

// Function to extract error logs from Vitest output
function extractVitestErrorLogs(): { formatted: string; raw: string } {
  let failedTestsOutput = "";
  let rawErrorLogs = "";

  try {
    // Check GitHub output logs or local logs directory
    if (
      process.env.GITHUB_STEP_SUMMARY &&
      fs.existsSync(process.env.GITHUB_STEP_SUMMARY)
    ) {
      // Read from GitHub step summary if available
      const content = fs.readFileSync(process.env.GITHUB_STEP_SUMMARY, "utf-8");
      const failLines = content
        .split("\n")
        .filter((line) => line.trim().startsWith("FAIL"));

      if (failLines.length > 0) {
        rawErrorLogs = failLines.join("\n");
        failedTestsOutput = `\n\n*Failed Tests:*\n\`\`\`\n${failLines.join("\n")}\n\`\`\``;
      }
    } else if (fs.existsSync("logs")) {
      // If GitHub logs are not available, try to find in local logs directory
      const logFiles = fs
        .readdirSync("logs")
        .filter((file) => file.endsWith(".log"));

      const failedTests: string[] = [];

      for (const logFile of logFiles) {
        const logPath = path.join("logs", logFile);
        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n");

        // Extract lines that start with "FAIL" which are typically Vitest failure outputs
        for (const line of lines) {
          if (line.trim().startsWith("FAIL")) {
            failedTests.push(line.trim());
          }
        }
      }

      if (failedTests.length > 0) {
        rawErrorLogs = failedTests.join("\n");
        failedTestsOutput = `\n\n*Failed Tests:*\n\`\`\`\n${failedTests.join("\n")}\n\`\`\``;
      }
    }
  } catch (error) {
    console.error("Error extracting Vitest error logs:", error);
  }

  return { formatted: failedTestsOutput, raw: rawErrorLogs };
}

// Extract error logs
const { formatted: formattedErrorLogs, raw: rawErrorLogs } =
  extractVitestErrorLogs();

// Type definition for Slack API response
interface SlackApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

// Send to Slack using the API
async function sendSlackNotification() {
  console.debug("Sending Slack notification...");

  try {
    // Get AI analysis of error logs if available
    let aiAnalysis = "";
    if (rawErrorLogs) {
      aiAnalysis = await analyzeErrorLogsWithGPT(rawErrorLogs);
    }
    let customLinks = "";
    if (testName && testName.toLowerCase() === "ts_agents") {
      customLinks = `• *Agents tested:* <https://github.com/xmtp/xmtp-qa-testing/blob/main/suites/TS_Agents/production.json|View file>`;
    }

    // Create a message with GitHub context and AI analysis
    const message = `*XMTP Test Failure ❌*
      • *Test Suite:* <https://github.com/xmtp/xmtp-qa-testing/actions/workflows/${workflowName}.yml|${workflowName}>
      • *Test Run URL:* <${workflowUrl}|View Run Details>
      • *Dashboard:* <${datadogUrl}|View in Datadog>
      • *Timestamp:* ${new Date().toISOString()}
      ${customLinks}
      ${formattedErrorLogs}
      ${aiAnalysis}`;

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: slackChannel,
        text: message,
        mrkdwn: true,
      }),
    });

    const data = (await response.json()) as SlackApiResponse;

    if (data && data.ok) {
      console.debug("✅ Slack notification sent successfully!");
    } else {
      console.error("❌ Failed to send Slack notification. Response:", data);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    process.exit(1);
  }
}

sendSlackNotification().catch((err: unknown) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
