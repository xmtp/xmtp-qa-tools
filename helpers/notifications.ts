import fetch from "node-fetch";
import { sendDatadogLog } from "./datadog";

// Type definitions for Slack functionality
interface SlackApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

export interface SlackNotificationOptions {
  testName: string;
  label?: "error" | "warning" | "info";
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

class SlackNotifier {
  private readonly slackChannel: string;
  private readonly datadogUrl: string;
  private readonly githubContext: GitHubContext;

  constructor() {
    this.slackChannel = process.env.SLACK_CHANNEL || "general";
    this.datadogUrl =
      "https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&from_ts=1746630906777&to_ts=1746717306777&live=true";
    this.githubContext = this.getGitHubContext();
  }

  private getGitHubContext(): GitHubContext {
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

  private hasErrorLogs(options: SlackNotificationOptions): boolean {
    const jobStatus = options.jobStatus || "failed";

    if (!options.errorLogs || options.errorLogs.size === 0) {
      console.log(
        "Slack notification skipped (no error logs in local development)",
      );
      return false;
    }

    const hasTestFailure = Array.from(options.errorLogs).some((log) =>
      log.includes("test.ts"),
    );

    if (!hasTestFailure) {
      console.log(
        "Slack notification skipped (no actual test failures detected)",
      );
      return false;
    }

    if (
      jobStatus === "success" ||
      (this.githubContext.branchName !== "main" && process.env.GITHUB_ACTIONS)
    ) {
      console.log(
        `Slack notification skipped (status: ${jobStatus}, branch: ${this.githubContext.branchName})`,
      );
      return false;
    }

    return true;
  }

  private getServiceId(region: string): string {
    const serviceIds: Record<string, string> = {
      europe: "c05a415c-23a6-46b9-ae8c-1935a219bae1",
      "us-east": "d92446b3-7ee4-43c9-a2ec-ceac87082970",
      "us-west": "00a6919a-a123-496b-b072-a149798099f9",
      asia: "cc97c743-1be5-4ca3-a41d-0109e41ca1fd",
    };
    return serviceIds[region] || "";
  }

  private generateCustomLinks(testName: string): string {
    if (testName.toLowerCase().includes("agents")) {
      return `*Agents tested:* <https://github.com/xmtp/xmtp-qa-tools/blob/main/suites/at_agents/production.json|View file>`;
    }
    return "";
  }

  private generateUrl(): string {
    if (this.githubContext.workflowUrl) {
      return `*Test log:* <${this.githubContext.workflowUrl}|View url>`;
    }

    const serviceId = this.getServiceId(this.githubContext.region || "");
    if (serviceId) {
      return `*Test log:* <https://railway.com/project/${serviceId}/service/${serviceId}/schedule?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792|View url>`;
    }
    return "";
  }

  private generateMessage(options: SlackNotificationOptions): string {
    const upperCaseTestName = options.testName
      ? options.testName[0].toUpperCase() + options.testName.slice(1)
      : "";

    const customLinks =
      options.customLinks || this.generateCustomLinks(options.testName);
    const url = this.generateUrl();

    return `*Test Failure ❌*
*Test:* <https://github.com/xmtp/xmtp-qa-tools/actions/workflows/${this.githubContext.workflowName}.yml|${upperCaseTestName}>
*Environment:* \`${this.githubContext.environment}\`
*General dashboard:* <${this.datadogUrl}|View>
*Geolocation:* \`${this.githubContext.region || "Unknown Region"}\`
*Timestamp:* \`${new Date().toLocaleString()}\`
${url}
${customLinks}
Logs:
\`\`\`${Array.from(options.errorLogs || []).join("\n")}\`\`\``;
  }

  public async sendNotification(
    options: SlackNotificationOptions,
  ): Promise<void> {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.log("Slack notification skipped (SLACK_BOT_TOKEN not set)");
      return;
    }

    if (options.label === "error" && !this.hasErrorLogs(options)) {
      return;
    }

    if (options.errorLogs) {
      await sendDatadogLog(Array.from(options.errorLogs), {
        testName: options.testName,
        environment: this.githubContext.environment,
      });
    }

    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: this.slackChannel,
          text: this.generateMessage(options),
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
}

// Public API - keep it simple
export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<void> {
  const notifier = new SlackNotifier();
  await notifier.sendNotification(options);
}
