/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Base name (e.g., ENS name) */
  baseName: string;
  /** Ethereum address */
  address: string;
  /** Whether the agent should respond to tagged messages */
  respondOnTagged: boolean;
  /** Message to send for testing */
  sendMessage: string;
  /** Expected response messages (optional) */
  expectedMessage?: string[];
  /** Networks the agent supports */
  networks: string[];
  /**  the agent is production */
  live: boolean;
}
