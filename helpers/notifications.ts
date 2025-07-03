import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";
import { sanitizeLogs } from "./analyzer";

export async function sendSlackNotification(options: {
  testName: string;
  errorLogs: Set<string>;
  channel?: string;
}): Promise<void> {
  const targetChannel = options.channel || process.env.SLACK_CHANNEL;
  const testName = options.testName
    ? options.testName[0].toUpperCase() + options.testName.slice(1) + " - "
    : "";

  const errorLogsArr = Array.from(options.errorLogs || []);
  const logs = sanitizeLogs(errorLogsArr.join("\n"));

  const shouldTagFabri = options.errorLogs.size >= PATTERNS.minFailLines;
  const tagMessage = shouldTagFabri ? " <@fabri>" : "";

  const sections = [
    `*${testName}*: ⚠️ - ${tagMessage}`,
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
