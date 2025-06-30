import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";
import {
  extractFailLines,
  sanitizeLogs,
  shouldFilterOutTest,
} from "./analyzer";
import { sendDatadogLog } from "./datadog";

// Notification providers
export enum NotificationProvider {
  SLACK = "slack",
  DISCORD = "discord",
  EMAIL = "email",
}

// Notification types
export enum NotificationType {
  ERROR = "error",
  WARNING = "warning", 
  INFO = "info",
  SUCCESS = "success",
  AGENT_FAILURE = "agent_failure",
  TEST_FAILURE = "test_failure",
}

// Base notification options
export interface BaseNotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

// Provider-specific options
export interface SlackNotificationOptions extends BaseNotificationOptions {
  provider: NotificationProvider.SLACK;
  channel?: string;
  botToken?: string;
  threadTs?: string;
  blocks?: unknown[];
}

export interface DiscordNotificationOptions extends BaseNotificationOptions {
  provider: NotificationProvider.DISCORD;
  webhookUrl?: string;
  username?: string;
  avatarUrl?: string;
}

export interface EmailNotificationOptions extends BaseNotificationOptions {
  provider: NotificationProvider.EMAIL;
  to: string[];
  from?: string;
  subject?: string;
}

// Union type for all notification options
export type NotificationOptions = 
  | SlackNotificationOptions 
  | DiscordNotificationOptions 
  | EmailNotificationOptions;

// Agent-specific notification options
export interface AgentNotificationOptions {
  agentName: string;
  agentAddress: string;
  errorLogs?: Set<string>;
  testName: string;
  env?: string;
  slackChannel?: string;
  failedTestsCount?: number;
  totalTestsCount?: number;
  responseTime?: number;
  customLinks?: string;
}

// Configuration URLs
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

/**
 * Generic notification service that supports multiple providers
 */
export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send a notification using the specified provider
   */
  public async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      switch (options.provider) {
        case NotificationProvider.SLACK:
          await this.sendSlackNotification(options);
          break;
        case NotificationProvider.DISCORD:
          await this.sendDiscordNotification(options);
          break;
        case NotificationProvider.EMAIL:
          await this.sendEmailNotification(options);
          break;
        default:
          throw new Error(`Unsupported notification provider: ${(options as any).provider}`);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }

  /**
   * Send agent-specific notifications with enhanced formatting
   */
  public async sendAgentNotification(options: AgentNotificationOptions): Promise<void> {
    const {
      agentName,
      agentAddress,
      errorLogs,
      testName,
      env = process.env.XMTP_ENV,
      slackChannel,
      responseTime,
      customLinks,
    } = options;

    // Skip notification conditions
    if (!this.shouldSendNotification(options)) {
      return;
    }

    // Send to Datadog if there are error logs
    if (errorLogs && errorLogs.size > 0) {
      const failLines = extractFailLines(errorLogs);
      await sendDatadogLog(Array.from(errorLogs), {
        test: testName,
        agent: agentName,
        url: this.generateUrl(),
        failLines: Array.from(failLines).length,
        env: env,
        region: process.env.GEOLOCATION,
        sdk: "latest",
      });
    }

    // Filter out tests that should be ignored
    if (errorLogs && shouldFilterOutTest(errorLogs)) {
      return;
    }

    const message = this.generateAgentMessage(options);
    const finalChannel = slackChannel || process.env.SLACK_CHANNEL || "#general";

    const slackOptions: SlackNotificationOptions = {
      provider: NotificationProvider.SLACK,
      title: `Agent Test Failure: ${agentName}`,
      message,
      type: NotificationType.AGENT_FAILURE,
      channel: finalChannel,
      timestamp: new Date(),
      metadata: {
        agentName,
        agentAddress,
        testName,
        env,
        responseTime,
      },
    };

    await this.sendNotification(slackOptions);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(options: SlackNotificationOptions): Promise<void> {
    const botToken = options.botToken || process.env.SLACK_BOT_TOKEN;
    
    if (!botToken) {
      console.log("Slack notification skipped (SLACK_BOT_TOKEN not set)");
      return;
    }

    const response = await fetch(URLS.SLACK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: options.channel || "#general",
        text: options.message,
        mrkdwn: true,
        thread_ts: options.threadTs,
        blocks: options.blocks,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      [key: string]: unknown;
    };

    if (data && data.ok) {
      console.log(`✅ Slack notification sent successfully to ${options.channel}!`);
    } else {
      console.error("❌ Failed to send Slack notification. Response:", data);
      throw new Error(`Failed to send Slack notification: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Send Discord notification (placeholder for future implementation)
   */
  private async sendDiscordNotification(options: DiscordNotificationOptions): Promise<void> {
    console.log("Discord notifications not yet implemented", options);
    throw new Error("Discord notifications not yet implemented");
  }

  /**
   * Send Email notification (placeholder for future implementation)
   */
  private async sendEmailNotification(options: EmailNotificationOptions): Promise<void> {
    console.log("Email notifications not yet implemented", options);
    throw new Error("Email notifications not yet implemented");
  }

  /**
   * Check if notification should be sent
   */
  private shouldSendNotification(options: AgentNotificationOptions): boolean {
    // Skip if no error logs for error notifications
    if (!options.errorLogs || options.errorLogs.size === 0) {
      console.log("Notification skipped (no actual test failures detected)");
      return false;
    }

    // Skip for non-main branches in CI
    const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
    if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
      console.log(`Notification skipped (branch: ${branchName})`);
      return false;
    }

    return true;
  }

  /**
   * Generate URL for the current test run
   */
  private generateUrl(): string | undefined {
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

  /**
   * Generate formatted message for agent notifications
   */
  private generateAgentMessage(options: AgentNotificationOptions): string {
    const {
      agentName,
      agentAddress,
      testName,
      env,
      errorLogs,
      responseTime,
      customLinks,
    } = options;

    const url = this.generateUrl();
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
}

// Convenience functions for backward compatibility
export async function sendSlackNotification(
  options: Omit<SlackNotificationOptions, 'provider'>
): Promise<void> {
  const service = NotificationService.getInstance();
  await service.sendNotification({
    ...options,
    provider: NotificationProvider.SLACK,
  });
}

export async function sendAgentNotification(
  options: AgentNotificationOptions
): Promise<void> {
  const service = NotificationService.getInstance();
  await service.sendAgentNotification(options);
}