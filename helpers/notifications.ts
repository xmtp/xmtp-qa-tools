import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";
import {
  extractFailLines,
  sanitizeLogs,
  shouldFilterOutTest,
} from "./analyzer";
import { sendDatadogLog } from "./datadog";

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

function generateMessage(options: SlackNotificationOptions): string {
  const testName = options.testName
    ? options.testName[0].toUpperCase() + options.testName.slice(1)
    : "";

  const errorLogsArr = Array.from(options.errorLogs || []);
  const logs = sanitizeLogs(errorLogsArr.join("\n"));

  const failLines = extractFailLines(options.errorLogs || new Set());
  const shouldTagFabri = failLines.length >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const sections = [
    `*${testName}*: ⚠️ - ${tagMessage}`,
    `Logs:\n\`\`\`${logs}\`\`\``,
  ];

  return sections.filter(Boolean).join("\n");
}

async function postToSlack(message: string, channel?: string): Promise<void> {
  const targetChannel = channel || process.env.SLACK_CHANNEL || "general";

  const response = await fetch("https://slack.com/api/chat.postMessage", {
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
    await sendDatadogLog(Array.from(options.errorLogs), {
      channel: options.channel,
      test: options.testName,
      failLines: Array.from(failLines).length,
      env: process.env.ENVIRONMENT || process.env.XMTP_ENV,
      region: process.env.GEOLOCATION,
      sdk: "latest",
    });
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
