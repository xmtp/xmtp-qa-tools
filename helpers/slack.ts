import "dotenv/config";
import fetch from "node-fetch";
import { sendDatadogLog } from "./datadog";

// Type definitions
interface SlackApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

export interface SlackNotificationOptions {
  testName: string;
  errorLogs?: Set<string>;
  customLinks?: string;
  jobStatus?: string;
  env?: string;
  failedTestsCount?: number;
  totalTestsCount?: number;
}

interface GitHubContext {
  workflowName: string;
  repository: string;
  runId: string;
  githubRef: string;
  branchName: string;
  workflowUrl: string;
  matrix?: string;
  environment?: string;
  region?: string;
}

// Get GitHub Actions context
function getGitHubContext(): GitHubContext {
  const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
  const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
  const runId = process.env.GITHUB_RUN_ID || "Unknown Run ID";
  const githubRef = process.env.GITHUB_REF || "Unknown Branch";
  const region = process.env.GEOLOCATION || "Unknown Region";
  const branchName = githubRef.replace("refs/heads/", "");

  let workflowUrl = "";
  if (repository !== "Unknown Repository" && runId !== "Unknown Run ID") {
    workflowUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  }

  // Get matrix values from environment variables
  // GitHub Actions sets these as individual env vars for each matrix key
  const matrixKeys = Object.keys(process.env)
    .filter((key) => key.startsWith("MATRIX_"))
    .map((key) => `${key.replace("MATRIX_", "")}: ${process.env[key]}`)
    .join(", ");

  return {
    workflowName,
    repository,
    runId,
    githubRef,
    branchName,
    workflowUrl,
    matrix: matrixKeys || undefined,
    environment: process.env.ENVIRONMENT || process.env.XMTP_ENV || undefined,
    region,
  };
}

// Check if error logs contain only worker errors
function isOnlyWorkerError(errorLogs?: Set<string>): boolean {
  if (!errorLogs || errorLogs.size === 0) {
    return false;
  }

  const lines = Array.from(errorLogs);

  // If there's only one line and it contains "worker" (case insensitive), consider it a worker error
  if (lines.length === 1) {
    return /worker/i.test(lines[0]);
  }

  return false;
}

// Check if notification should be sent
function shouldSendNotification(
  options: SlackNotificationOptions,
  githubContext: GitHubContext,
): boolean {
  const jobStatus = options.jobStatus || "failed";

  // Skip if only worker error
  if (isOnlyWorkerError(options.errorLogs)) {
    console.log("Slack notification skipped (only worker error detected)");
    return false;
  }

  // Only send notifications for failures on main branch (unless in local development)
  if (
    jobStatus === "success" ||
    (githubContext.branchName !== "main" && process.env.GITHUB_ACTIONS)
  ) {
    console.log(
      `Slack notification skipped (status: ${jobStatus}, branch: ${githubContext.branchName})`,
    );
    return false;
  }

  return true;
}

// Send Slack notification
export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<void> {
  // Check for required Slack credentials
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log("Slack notification skipped (SLACK_BOT_TOKEN not set)");
    return;
  }

  const githubContext = getGitHubContext();

  // Check if we should send the notification
  if (!shouldSendNotification(options, githubContext)) {
    return;
  }

  // Send each error log line to Datadog
  if (options.errorLogs) {
    const lines = Array.from(options.errorLogs);
    for (const line of lines) {
      // Only send non-empty lines
      await sendDatadogLog(line, {
        testName: options.testName,
        environment: githubContext.environment,
      });
    }
  }

  const slackChannel = process.env.SLACK_CHANNEL || "general";
  const datadogUrl =
    "https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&from_ts=1746630906777&to_ts=1746717306777&live=true";

  let upperCaseTestName = "";
  if (options.testName) {
    upperCaseTestName =
      options.testName[0].toUpperCase() + options.testName.slice(1);
  }
  // Generate custom links if needed
  let customLinks = options.customLinks || "";
  if (
    !customLinks &&
    options.testName &&
    options.testName.toLowerCase().includes("agents")
  ) {
    customLinks = `*Agents tested:* <https://github.com/xmtp/xmtp-qa-tools/blob/main/suites/at_agents/production.json|View file>`;
  }
  let url = "";
  if (githubContext.workflowUrl) {
    url = `*Test log:* <${githubContext.workflowUrl}|View url>`;
  } else {
    let serviceId = "";
    if (githubContext.region == "europe") {
      serviceId = "c05a415c-23a6-46b9-ae8c-1935a219bae1";
    } else if (githubContext.region == "us-east") {
      serviceId = "d92446b3-7ee4-43c9-a2ec-ceac87082970";
    } else if (githubContext.region == "us-west") {
      serviceId = "00a6919a-a123-496b-b072-a149798099f9";
    } else if (githubContext.region == "asia") {
      serviceId = "cc97c743-1be5-4ca3-a41d-0109e41ca1fd";
    }
    if (serviceId) {
      url = `*Test log:* <https://railway.com/project/${serviceId}/service/${serviceId}/schedule?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792|View url>`;
    }
  }

  const title = "*Test Failure ❌*";

  const message = `${title}\n\n*Test:* <https://github.com/xmtp/xmtp-qa-tools/actions/workflows/${githubContext.workflowName}.yml|${upperCaseTestName}>
*Environment:* \`${githubContext.environment}\`
*General dashboard:* <${datadogUrl}|View>
*Geolocation:* \`${githubContext.region || "Unknown Region"}\`
*Timestamp:* \`${new Date().toLocaleString()}\`
${url}
${customLinks}
Logs:
\`\`\`${Array.from(options.errorLogs || []).join("\n")}\`\`\`
`;

  try {
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
      console.log("✅ Slack notification sent successfully!");
    } else {
      console.error("❌ Failed to send Slack notification. Response:", data);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}
