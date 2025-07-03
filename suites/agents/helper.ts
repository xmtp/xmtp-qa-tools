/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Base name (e.g., ENS name) */
  baseName: string;
  /** Ethereum address */
  /** Whether the agent should respond to tagged messages */
  shouldRespondOnTagged: boolean;
  address: string;
  /** Message to send for testing */
  sendMessage: string;
  /** Expected response messages (optional) */
  expectedMessage?: string[];
  /** Networks the agent supports */
  networks: string[];
  /** Whether the agent is disabled */
  disabled?: boolean;
  /** Slack channel for notifications */
  slackChannel?: string;
  /** Whether to test this agent in groups (default: false) */
  groupTesting?: boolean;
}

/**
 * Agent test result interface
 */
export interface AgentTestResult {
  agentName: string;
  agentAddress: string;
  responded: boolean;
  responseTime?: number;
  errorMessage?: string;
  errorLogs?: Set<string>;
  retries?: number;
}

/**
 * Agent notification configuration
 */
export interface AgentNotificationConfig {
  /** Default Slack channel if not specified per agent */
  defaultSlackChannel?: string;
  /** Whether to send notifications for successful tests */
  notifyOnSuccess?: boolean;
  /** Whether to send notifications for failed tests */
  notifyOnFailure?: boolean;
  /** Custom message template */
  messageTemplate?: string;
}
