import "dotenv/config";
import fetch from "node-fetch";

// Type definitions
interface SlackApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

export interface SlackNotificationOptions {
  testName: string;
  errorLogs?: string;
  customLinks?: string;
  jobStatus?: string;
  env?: string;
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
}

// Get GitHub Actions context
function getGitHubContext(): GitHubContext {
  const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
  const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
  const runId = process.env.GITHUB_RUN_ID || "Unknown Run ID";
  const githubRef = process.env.GITHUB_REF || "Unknown Branch";
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
    environment: process.env.ENVIRONMENT || process.env.NODE_ENV || undefined,
  };
}

// Check if notification should be sent
function shouldSendNotification(
  options: SlackNotificationOptions,
  githubContext: GitHubContext,
): boolean {
  const jobStatus = options.jobStatus || "failed";

  // Only send notifications for failures on main branch (unless in local development)
  if (
    jobStatus === "success" ||
    jobStatus === "passed" ||
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

  const slackChannel = process.env.SLACK_CHANNEL || "general";
  const datadogUrl =
    "https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&from_ts=1746630906777&to_ts=1746717306777&live=true";

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
  }

  // Create message with error logs
  const message = `Test Failure ❌
*Test:* <https://github.com/xmtp/xmtp-qa-tools/actions/workflows/${githubContext.workflowName}.yml|${options.testName}>
${githubContext.environment ? `*Environment:* ${githubContext.environment}` : ""}
*General dashboard:* <${datadogUrl}|View>
*Timestamp:* ${new Date().toLocaleString()}
${customLinks}
${url}
${options.errorLogs || ""}`;

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
