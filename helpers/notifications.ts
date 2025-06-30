import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";
import {
  extractFailLines,
  sanitizeLogs,
  shouldFilterOutTest,
} from "./analyzer";
import { sendDatadogLog } from "./datadog";

// Configuration
const URLS = {
  DATADOG_DASHBOARD:
    "https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&from_ts=1746630906777&to_ts=1746717306777&live=true",
  DATADOG_LOGS: "https://app.datadoghq.com/logs?saved-view-id=3577227",
  SLACK_API: "https://slack.com/api/chat.postMessage",
  GITHUB_ACTIONS: "https://github.com",
  RAILWAY_PROJECT: "https://railway.com/project",
} as const;

const SERVICE_IDS: Record<string, string> = {
  europe: "c05a415c-23a6-46b9-ae8c-1935a219bae1",
  "us-east": "d92446b3-7ee4-43c9-a2ec-ceac87082970",
  "us-west": "00a6919a-a123-496b-b072-a149798099f9",
  asia: "cc97c743-1be5-4ca3-a41d-0109e41ca1fd",
} as const;

export interface SlackNotificationOptions {
  testName: string;
  label?: "error" | "warning" | "info";
  errorLogs?: Set<string>;
  customLinks?: string;
  jobStatus?: string;
  env?: string;
  failedTestsCount?: number;
  totalTestsCount?: number;
  channel?: string;
}

export interface AgentNotificationOptions {
  agentName: string;
  agentAddress: string;
  errorLogs?: Set<string>;
  testName: string;
  env?: string;
  slackChannel?: string;
  responseTime?: number;
  customLinks?: string;
}

function shouldSkipNotification(options: SlackNotificationOptions): boolean {
  const jobStatus = options.jobStatus || "failed";

  if (jobStatus === "success") {
    console.log(`Slack notification skipped (status: ${jobStatus})`);
    return true;
  }

  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.log(`Slack notification skipped (branch: ${branchName})`);
    return true;
  }

  return false;
}

function generateUrl(): string | undefined {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  if (repository && runId) {
    return `${URLS.GITHUB_ACTIONS}/${repository}/actions/runs/${runId}`;
  }

  const region = process.env.GEOLOCATION || "";
  const serviceId = SERVICE_IDS[region];
  if (serviceId) {
    return `${URLS.RAILWAY_PROJECT}/${serviceId}/service/${serviceId}/schedule?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792`;
  }

  return undefined;
}

function generateMessage(options: SlackNotificationOptions): string {
  const testName = options.testName
    ? options.testName[0].toUpperCase() + options.testName.slice(1)
    : "";
  const customLinks =
    options.customLinks ||
    (options.testName.toLowerCase().includes("agents")
      ? "*Agents tested:* <https://github.com/xmtp/xmtp-qa-tools/blob/main/inboxes/agents.json|View file>"
      : "");

  const url = generateUrl();
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const errorLogsArr = Array.from(options.errorLogs || []);
  const logs = sanitizeLogs(errorLogsArr.join("\n"));

  const failLines = extractFailLines(options.errorLogs || new Set());
  const shouldTagFabri = failLines.length >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
  const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
  const environment = process.env.ENVIRONMENT || process.env.XMTP_ENV;
  const region = process.env.GEOLOCATION || "Unknown Region";

  const sections = [
    `*Test Failure ❌*${tagMessage}`,
    `*Test:* <${URLS.GITHUB_ACTIONS}/${repository}/actions/workflows/${workflowName}.yml|${testName}>`,
    `*Environment:* \`${environment}\``,
    `*General dashboard:* <${URLS.DATADOG_DASHBOARD}|View>`,
    `*Geolocation:* \`${region}\``,
    `*Timestamp:* \`${timestamp}\``,
    `*Full logs:* <${URLS.DATADOG_LOGS}|View>`,
    url ? `*Test log:* <${url}|View url>` : "",
    customLinks,
    `Logs:\n\`\`\`${logs}\`\`\``,
  ];

  return sections.filter(Boolean).join("\n");
}

async function postToSlack(message: string, channel?: string): Promise<void> {
  const targetChannel = channel || process.env.SLACK_CHANNEL || "general";
  
  const response = await fetch(URLS.SLACK_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: targetChannel,
      text: message,
      mrkdwn: true,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    [key: string]: unknown;
  };

  if (data && data.ok) {
    console.log(`✅ Slack notification sent successfully to ${targetChannel}!`);
  } else {
    console.error("❌ Failed to send Slack notification. Response:", data);
  }
}

export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log("Slack notification skipped (SLACK_BOT_TOKEN not set)");
    return;
  }
  if (options.label === "error") {
    if (!options.errorLogs || options.errorLogs.size === 0) {
      console.log(
        "Slack notification skipped (no actual test failures detected)",
      );
      return;
    }

    if (shouldSkipNotification(options)) {
      return;
    }
  }

  if (options.errorLogs && options.errorLogs.size > 0) {
    const failLines = extractFailLines(options.errorLogs);
    await sendDatadogLog(
      Array.from(options.errorLogs),
      {
        test: options.testName,
        url: generateUrl(),
        failLines: Array.from(failLines).length,
        env: process.env.ENVIRONMENT || process.env.XMTP_ENV,
        region: process.env.GEOLOCATION,
        sdk: "latest",
      },
      options.channel,
    );
  }

  // Check if test should be filtered out
  if (options.errorLogs && shouldFilterOutTest(options.errorLogs)) {
    return;
  }

  try {
    const message = generateMessage(options);
    await postToSlack(message, options.channel);
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}

function generateAgentMessage(options: AgentNotificationOptions): string {
  const {
    agentName,
    agentAddress,
    testName,
    env,
    errorLogs,
    responseTime,
    customLinks,
  } = options;

  const url = generateUrl();
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const errorLogsArr = Array.from(errorLogs || []);
  const logs = sanitizeLogs(errorLogsArr.join("\n"));

  const failLines = extractFailLines(errorLogs || new Set());
  const shouldTagFabri = failLines.length >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
  const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
  const region = process.env.GEOLOCATION || "Unknown Region";

  const agentLinks = customLinks || 
    `*Agent tested:* <https://github.com/xmtp/xmtp-qa-tools/blob/main/inboxes/agents.json|${agentName}>`;

  const responseTimeInfo = responseTime 
    ? `*Response Time:* \`${responseTime}ms\`` 
    : "";

  const sections = [
    `*Agent Test Failure ❌*${tagMessage}`,
    `*Agent:* \`${agentName}\``,
    `*Address:* \`${agentAddress}\``,
    `*Test:* <${URLS.GITHUB_ACTIONS}/${repository}/actions/workflows/${workflowName}.yml|${testName}>`,
    `*Environment:* \`${env}\``,
    `*Geolocation:* \`${region}\``,
    responseTimeInfo,
    `*Timestamp:* \`${timestamp}\``,
    `*General dashboard:* <${URLS.DATADOG_DASHBOARD}|View>`,
    `*Full logs:* <${URLS.DATADOG_LOGS}|View>`,
    url ? `*Test log:* <${url}|View url>` : "",
    agentLinks,
    `Logs:\n\`\`\`${logs}\`\`\``,
  ];

  return sections.filter(Boolean).join("\n");
}

function shouldSkipAgentNotification(options: AgentNotificationOptions): boolean {
  // Skip if no error logs for error notifications
  if (!options.errorLogs || options.errorLogs.size === 0) {
    console.log("Agent notification skipped (no actual test failures detected)");
    return false;
  }

  // Skip for non-main branches in CI
  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.log(`Agent notification skipped (branch: ${branchName})`);
    return true;
  }

  return false;
}

export async function sendAgentNotification(
  options: AgentNotificationOptions,
): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log("Agent notification skipped (SLACK_BOT_TOKEN not set)");
    return;
  }

  // Skip notification conditions
  if (shouldSkipAgentNotification(options)) {
    return;
  }

  // Send to Datadog if there are error logs
  if (options.errorLogs && options.errorLogs.size > 0) {
    const failLines = extractFailLines(options.errorLogs);
    await sendDatadogLog(
      Array.from(options.errorLogs),
      {
        test: options.testName,
        agent: options.agentName,
        url: generateUrl(),
        failLines: Array.from(failLines).length,
        env: options.env || process.env.XMTP_ENV,
        region: process.env.GEOLOCATION,
        sdk: "latest",
      },
      options.slackChannel,
    );
  }

  // Filter out tests that should be ignored
  if (options.errorLogs && shouldFilterOutTest(options.errorLogs)) {
    return;
  }

  try {
    const message = generateAgentMessage(options);
    const finalChannel = options.slackChannel || process.env.SLACK_CHANNEL || "#general";
    await postToSlack(message, finalChannel);
  } catch (error) {
    console.error("Error sending agent notification:", error);
  }
}
