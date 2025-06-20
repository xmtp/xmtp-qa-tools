import fetch from "node-fetch";
import { sendDatadogLog } from "./datadog";
import { KNOWN_ISSUES } from "./logger";

// Configuration constants
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

const TIMEZONE = "America/Argentina/Buenos_Aires";

// Type definitions
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

interface TestFilter {
  testName: string;
  uniqueErrorLines: string[];
}

class SlackNotifier {
  private readonly slackChannel: string;
  private readonly githubContext: GitHubContext;
  private readonly testFilters: TestFilter[];

  constructor() {
    this.slackChannel = process.env.SLACK_CHANNEL || "general";
    this.githubContext = this.getGitHubContext();
    this.testFilters = KNOWN_ISSUES;
  }

  private getGitHubContext(): GitHubContext {
    const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
    const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
    const runId = process.env.GITHUB_RUN_ID || "Unknown Run ID";
    const githubRef = process.env.GITHUB_REF || "Unknown Branch";
    const region = process.env.GEOLOCATION || "Unknown Region";
    const branchName = githubRef.replace("refs/heads/", "");

    const workflowUrl = this.buildGitHubWorkflowUrl(repository, runId);
    const matrix = this.extractMatrixInfo();

    return {
      workflowName,
      repository,
      runId,
      githubRef,
      branchName,
      workflowUrl,
      matrix,
      environment: process.env.ENVIRONMENT || process.env.XMTP_ENV || undefined,
      region,
    };
  }

  private buildGitHubWorkflowUrl(repository: string, runId: string): string {
    if (repository === "Unknown Repository" || runId === "Unknown Run ID") {
      return "";
    }
    return `${URLS.GITHUB_ACTIONS}/${repository}/actions/runs/${runId}`;
  }

  private extractMatrixInfo(): string | undefined {
    const matrixKeys = Object.keys(process.env)
      .filter((key) => key.startsWith("MATRIX_"))
      .map((key) => `${key.replace("MATRIX_", "")}: ${process.env[key]}`)
      .join(", ");

    return matrixKeys || undefined;
  }

  private hasValidErrorLogs(options: SlackNotificationOptions): boolean {
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

    return true;
  }

  private shouldSkipNotification(options: SlackNotificationOptions): boolean {
    const jobStatus = options.jobStatus || "failed";

    if (jobStatus === "success") {
      console.log(`Slack notification skipped (status: ${jobStatus})`);
      return true;
    }

    if (
      this.githubContext.branchName !== "main" &&
      process.env.GITHUB_ACTIONS
    ) {
      console.log(
        `Slack notification skipped (branch: ${this.githubContext.branchName})`,
      );
      return true;
    }

    return false;
  }

  private extractFailLines(errorLogs: Set<string>): string[] {
    return Array.from(errorLogs).filter((log) => log.includes("FAIL  suites/"));
  }

  private shouldFilterOutTest(options: SlackNotificationOptions): boolean {
    if (!options.errorLogs || options.errorLogs.size === 0) {
      return false;
    }

    const failLines = this.extractFailLines(options.errorLogs);

    if (failLines.length === 0) {
      return true; // Don't show if tests don't fail
    }

    // Check each configured filter
    for (const filter of this.testFilters) {
      const matchingLines = failLines.filter((line) =>
        filter.uniqueErrorLines.some((errorLine) => line.includes(errorLine)),
      );

      // If all fail lines match this filter's unique error lines, filter it out
      if (
        matchingLines.length > 0 &&
        matchingLines.length === failLines.length
      ) {
        console.log(
          `Slack notification skipped (filtered out ${filter.testName} test failure)`,
        );
        return true;
      }
    }

    return false;
  }

  private generateCustomLinks(testName: string): string {
    if (testName.toLowerCase().includes("agents")) {
      return "*Agents tested:* <https://github.com/xmtp/xmtp-qa-tools/blob/main/suites/at_agents/production.json|View file>";
    }
    return "";
  }

  private generateUrl(): string | undefined {
    if (this.githubContext.workflowUrl) {
      return this.githubContext.workflowUrl;
    }

    const serviceId = SERVICE_IDS[this.githubContext.region || ""];
    if (serviceId) {
      return `${URLS.RAILWAY_PROJECT}/${serviceId}/service/${serviceId}/schedule?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792`;
    }

    return undefined;
  }

  private sanitizeLogs(logs: string): string {
    return logs.replaceAll(/```/g, "'''");
  }

  private formatTestName(testName: string): string {
    return testName ? testName[0].toUpperCase() + testName.slice(1) : "";
  }

  private generateMessage(options: SlackNotificationOptions): string {
    const upperCaseTestName = this.formatTestName(options.testName);
    const customLinks =
      options.customLinks || this.generateCustomLinks(options.testName);
    const url = this.generateUrl();
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: TIMEZONE,
    });

    // Sanitize logs before embedding in Slack message
    const errorLogsArr = Array.from(options.errorLogs || []);
    const logs = this.sanitizeLogs(errorLogsArr.join("\n"));

    const sections = [
      "*Test Failure ❌*",
      `*Test:* <${URLS.GITHUB_ACTIONS}/${this.githubContext.repository}/actions/workflows/${this.githubContext.workflowName}.yml|${upperCaseTestName}>`,
      `*Environment:* \`${this.githubContext.environment}\``,
      `*General dashboard:* <${URLS.DATADOG_DASHBOARD}|View>`,
      `*Geolocation:* \`${this.githubContext.region || "Unknown Region"}\``,
      `*Timestamp:* \`${timestamp}\``,
      `*Full logs:* <${URLS.DATADOG_LOGS}|View>`,
      url ? `*Test log:* <${url}|View url>` : "",
      customLinks,
      `Logs:\n\`\`\`${logs}\`\`\``,
    ];

    return sections.filter(Boolean).join("\n");
  }

  private async postToSlack(message: string): Promise<void> {
    const response = await fetch(URLS.SLACK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: this.slackChannel,
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
  }

  public async sendNotification(
    options: SlackNotificationOptions,
  ): Promise<void> {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.log("Slack notification skipped (SLACK_BOT_TOKEN not set)");
      return;
    }

    if (options.label === "error") {
      if (
        !this.hasValidErrorLogs(options) ||
        this.shouldSkipNotification(options)
      ) {
        return;
      }
    }

    if (options.errorLogs) {
      await sendDatadogLog(Array.from(options.errorLogs), {
        test: options.testName,
        url: this.generateUrl(),
        errorLogs: Array.from(options.errorLogs).length,
        env: this.githubContext.environment,
        region: this.githubContext.region,
        libxmtp: "latest",
      });
    }

    // Check if test should be filtered out
    if (this.shouldFilterOutTest(options)) {
      return;
    }

    try {
      const message = this.generateMessage(options);
      await this.postToSlack(message);
    } catch (error) {
      console.error("Error sending Slack notification:", error);
    }
  }
}

/**
 * Send a Slack notification with the provided options
 */
export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<void> {
  const notifier = new SlackNotifier();
  await notifier.sendNotification(options);
}
