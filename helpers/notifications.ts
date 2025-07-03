import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";
import { sanitizeLogs } from "./analyzer";

export interface SlackNotificationOptions {
  testName: string;
  label?: "error" | "warning" | "info";
  errorLogs?: Set<string>;
  customLinks?: string;
  failLines?: number;
  jobStatus?: string;
  env?: string;
  failedTestsCount?: number;
  totalTestsCount?: number;
  channel?: string;
}

export async function sendSlackNotification(
  options: SlackNotificationOptions,
  channel?: string,
): Promise<void> {
  const targetChannel = channel || process.env.SLACK_CHANNEL || "general";
  const testName = options.testName
    ? options.testName[0].toUpperCase() + options.testName.slice(1) + " - "
    : "";

  const errorLogsArr = Array.from(options.errorLogs || []);
  const logs = sanitizeLogs(errorLogsArr.join("\n"));

  const shouldTagFabri = options.failLines >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const sections = [
    `*${testName}*: ⚠️ - ${tagMessage}`,
    `URL: ${options.customLinks}`,
    `Logs:\n\`\`\`${logs}\`\`\``,
  ];

  const message = sections.filter(Boolean).join("\n");
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
